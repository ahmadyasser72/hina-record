import { create, type MessageInitShape, toBinary } from "@bufbuild/protobuf";
import { dayjs } from "@hina-record/shared/date";
import { createId, db, GBP, redis } from "@hina-record/shared/db";
import {
	type Tracker,
	trackerSnapshots,
	trackerSnapshotsTop,
	trackerSnapshotsTopProfiles,
	trackerSnapshotsTopSessions,
	trackerSnapshotsToTop,
} from "@hina-record/shared/db/schema";
import { GbpBandByCharacter, type GbpCharacter } from "@hina-record/shared/db/schema/types";
import type { UserProfile } from "@hina-record/shared/gbp/gen/profile_pb";
import type {
	MasterAreaItem,
	MasterCharacterSituation,
	MasterSituationParameterSchema,
	MasterSituationSkill,
	MasterSkill,
} from "@hina-record/shared/gbp/gen/suite_master_pb";
import {
	type TrackerProfileAvatarSchema,
	type TrackerProfileBandMemberSchema,
	TrackerProfileSchema,
} from "@hina-record/shared/gbp/gen/tracker_profile_pb";
import type { RankingUser } from "@hina-record/shared/gbp/gen/tracker_ranking_pb";
import { xxhash } from "@hina-record/shared/hash";
import {
	AbortTaskRunError,
	metadata,
	schedules,
	schemaTask,
	tags,
	wait,
	type TaskPayload,
} from "@trigger.dev/sdk";
import { eq, sql } from "drizzle-orm";
import { chunk, uniq, uniqBy, zip } from "es-toolkit";
import { pick } from "es-toolkit/fp";
import z from "zod";

import { bangDream, type GbpCredentials } from "#root/fetch.ts";

export const updateTracker = schedules.task({
	id: "update-tracker",
	cron: "* * * * *",
	ttl: "1m",
	retry: { maxAttempts: 1 },

	onStartAttempt: async ({ ctx }) => {
		ctx.task.hash = {};
	},
	onComplete: async ({ ctx }) => {
		const hashes = ctx.task.hash as Record<string, number>;
		if (Object.keys(hashes).length > 0) {
			metadata.set("hash.update", hashes);
			await redis().hset(GBP.responses, hashes);
		}
	},

	run: async ({ timestamp }, { ctx }) => {
		const [version, maintenance] = await redis().mget<[string | null, true | null]>(
			GBP.version,
			GBP.maintenance,
		);
		if (!version || maintenance) return;

		const now = dayjs(timestamp).startOf("minute").add(1, "minute");
		await wait.until({ date: now.toDate() });

		const references = await db().query.trackerReferences.findMany({
			columns: { kind: true, id: true, type: true, name: true, data: true },
			where: {
				startAt: { lte: now.toDate() },
				endAt: { gte: now.add(30, "minutes").toDate() },
			},
			with: {
				snapshots: {
					columns: {},
					orderBy: { id: "desc" },
					limit: 1,
					with: {
						top: {
							columns: {
								musicId: true,
								uid: true,
								point: true,
								profileId: true,
							},
							with: {
								session: {
									where: { endAt: { lte: now.subtract(30, "minutes").toDate() } },
								},
							},
						},
					},
				},
			},
		});
		if (references.length === 0) return;

		metadata.set("reference", references.map(pick(["kind", "id", "name"])));

		const [credentials, hashes] = await redis()
			.pipeline()
			.hgetall(GBP.credentials.static)
			.hmget(
				GBP.responses,
				...references.flatMap(({ kind, id, type, data, snapshots }) => {
					const hash = GBP.hash.ranking({ kind, id });
					const keys = [hash.full, hash.top()] as string[];

					if (type === "medley") keys.push(hash.top(1));
					else if (data.metadata.value && "musics" in data.metadata.value)
						keys.push(...data.metadata.value.musics.map(({ id }) => hash.top(id)));

					if (snapshots.length > 0)
						keys.push(...snapshots[0].top.map(({ uid }) => hash.userDeck(uid)));

					return keys;
				}),
			)
			.exec<[GbpCredentials | null, Record<string, number | null> | null]>();
		if (!credentials) throw new AbortTaskRunError("BanG Dream credentials are missing.");

		metadata.set("hash", hashes);

		const snapshots = [] as Tracker.NewSnapshot[];
		for (const reference of references) {
			const ranking = await bangDream.ranking(version, credentials, reference);
			await tags.add(`${reference.type}_${ranking.response.hash}`);

			const hash = GBP.hash.ranking(reference);
			if (ranking.response.hash === hashes?.[hash.full]) {
				references.splice(references.indexOf(reference), 1);
				await tags.add(`${reference.type}_skip`);
				continue;
			}

			(ctx.task.hash as Record<string, number>)[hash.full] = ranking.response.hash;

			snapshots.push({
				id: createId(),
				trackerKind: reference.kind,
				trackerId: reference.id,
				timestamp: now.toDate(),
				data: ranking.data,
			});
		}
		if (snapshots.length === 0) return;

		const syncProfiles = [] as TaskPayload<typeof updateTrackerProfile>["users"];
		const top = [] as {
			values: Tracker.NewSnapshotTop[];
			snapshot: (typeof snapshots)[number];
			sessions: Tracker.NewSnapshotTopSession[];
		}[];
		for (const [snapshot, reference] of zip(snapshots, references)) {
			if (!snapshot.data!.snapshot.value?.top?.entries) continue;

			const values = [] as (typeof top)[number]["values"];
			const sessions = [] as (typeof top)[number]["sessions"];
			const lookupPrevious = new Map(
				reference.snapshots.at(0)?.top.map((value) => [`${value.musicId}:${value.uid}`, value]),
			);

			const hash = GBP.hash.ranking(reference);
			const pushIfHashNotMatch = (users: RankingUser[], musicId = 0) => {
				const key = hash.top(musicId);
				const rankingHash = xxhash.h32(
					users.map(({ uid, name, point }) => [uid, name, point].join("|")).join("\n"),
				);

				if (hashes?.[key] === rankingHash) return;
				else (ctx.task.hash as Record<string, number>)[key] = rankingHash;

				for (let idx = 0; idx < users.length; idx += 1) {
					const user = users[idx];
					const previous = lookupPrevious.get(`${musicId}:${user.uid}`);
					const point = Number(user.point);
					const pointGain = previous ? point - previous.point : 0;

					let sessionId: Tracker.NewSnapshotTop["sessionId"] = null;
					if (musicId === 0 && pointGain > 0) {
						const session = previous?.session ?? {
							id: createId(),
							uid: user.uid,
							startAt: now.toDate(),
							endAt: now.toDate(),
							points: 0,
							games: 0,
						};

						session.points += pointGain;
						session.games += 1;
						session.endAt = now.toDate();
						sessions.push(session);
						sessionId = session.id;
					}

					const value: Tracker.NewSnapshotTop = {
						id: createId(),
						trackerKind: reference.kind,
						trackerId: reference.id,
						snapshotId: snapshot.id,
						musicId,
						uid: user.uid,
						name: user.name,
						rank: user.rank,
						point,
						pointGain,
						profileId: previous?.profileId,
						sessionId,
						timestamp: snapshot.timestamp,
					};

					if ((!value.profileId || pointGain > 0) && user.userSituationList) {
						const key = hash.userDeck(user.uid);
						const deckHash = xxhash.h32(
							user.userSituationList.entries.flatMap(Object.values).join(","),
						);

						if (hashes?.[key] !== deckHash) {
							value.profileId = null;
							syncProfiles.push({
								top: value.id,
								uid: user.uid,
								reference: { kind: reference.kind, id: reference.id },
							});
							(ctx.task.hash as Record<string, number>)[key] = deckHash;
						}
					}

					values.push(value);
				}
			};

			pushIfHashNotMatch(snapshot.data!.snapshot.value.top.entries);

			if ("musics" in snapshot.data!.snapshot.value) {
				for (const { id, top } of snapshot.data!.snapshot.value.musics) {
					if (top) pushIfHashNotMatch(top.entries, id);
				}
			} else if (
				"topMusic" in snapshot.data!.snapshot.value &&
				snapshot.data!.snapshot.value.topMusic
			) {
				pushIfHashNotMatch(snapshot.data!.snapshot.value.topMusic.entries, 1);
			}

			if (values.length > 0) top.push({ snapshot, values, sessions });
		}
		if (top.length === 0) return;

		const upsert = ({ snapshot, values, sessions }: (typeof top)[number]) =>
			[
				db().insert(trackerSnapshots).values(snapshot).returning({ id: trackerSnapshots.id }),
				db()
					.insert(trackerSnapshotsTopSessions)
					.values(sessions)
					.onConflictDoUpdate({
						target: trackerSnapshotsTopSessions.id,
						set: {
							endAt: sql.raw(`excluded.${trackerSnapshotsTopSessions.endAt.name}`),
							games: sql.raw(`excluded.${trackerSnapshotsTopSessions.games.name}`),
							points: sql.raw(`excluded.${trackerSnapshotsTopSessions.points.name}`),
						},
					}),
				db()
					.insert(trackerSnapshotsTop)
					.values(values)
					.onConflictDoUpdate({
						target: [
							trackerSnapshotsTop.trackerKind,
							trackerSnapshotsTop.trackerId,
							trackerSnapshotsTop.musicId,
							trackerSnapshotsTop.rank,
							trackerSnapshotsTop.uid,
							trackerSnapshotsTop.name,
							trackerSnapshotsTop.point,
						],
						set: {
							uid: sql.raw(`excluded.${trackerSnapshotsTop.uid.name}`),
						},
					})
					.returning({ id: trackerSnapshotsTop.id }),
			] as const;

		metadata.set(
			"upsert",
			zip(top.map(pick(["values"])), references.map(pick(["snapshots"]))) as never,
		);
		const results = await db().batch(top.flatMap(upsert) as [...ReturnType<typeof upsert>]);

		await db()
			.insert(trackerSnapshotsToTop)
			.values(
				chunk(results, 3).flatMap((result) => {
					type R<I extends 0 | 2> = Awaited<ReturnType<typeof upsert>[I]>;
					const [snapshot] = result[0] as R<0>;
					return (result[2] as R<2>).map(({ id }) => ({ snapshotId: snapshot.id, topId: id }));
				}),
			);
		if (syncProfiles.length > 0)
			await updateTrackerProfile.trigger({ version, users: syncProfiles });
	},
});

export const updateTrackerProfile = schemaTask({
	id: "update-tracker-profile",
	schema: z.object({
		version: z.string(),
		users: z.array(
			z.object({
				top: z.string(),
				uid: z.string(),
				reference: z.object({ kind: z.enum(["event", "monthly"]), id: z.number() }),
			}),
		),
	}),
	concurrency: { total: 1 },
	retry: { maxAttempts: 1 },

	onStartAttempt: async ({ ctx }) => {
		const credentials = await redis().hgetall(GBP.credentials.rolling);
		if (!credentials) throw new AbortTaskRunError("BanG Dream credentials are missing.");
		ctx.task.credentials = credentials;
	},
	onComplete: async ({ ctx }) => {
		await redis().hset(GBP.credentials.rolling, {
			token: (ctx.task.credentials as GbpCredentials).token,
		});
	},

	run: async ({ version, users }, { ctx }) => {
		const credentials = ctx.task.credentials as GbpCredentials;

		const uids = uniq(users.map(({ uid }) => uid));
		const profiles = new Map<string, UserProfile>();
		const areaItemIds = new Set<number>();
		const situationIds = new Set<number>();

		for (let idx = 0; idx < uids.length; idx += 1) {
			const uid = uids[idx];
			const profile = await bangDream.profile(version, credentials, uid);
			credentials.token = profile.response.token;

			profiles.set(uid, profile.data);

			if (profile.data.enabledUserAreaItems?.entries) {
				const e = profile.data.enabledUserAreaItems.entries;
				for (let idx = 0; idx < e.length; idx += 1) areaItemIds.add(e[idx].areaItemId);
			}

			if (profile.data.userProfileSituation?.situationId)
				situationIds.add(profile.data.userProfileSituation.situationId);

			if (profile.data.mainDeckUserSituations?.entries) {
				const e = profile.data.mainDeckUserSituations.entries;
				for (let idx = 0; idx < e.length; idx += 1) situationIds.add(e[idx].situationId);
			}
		}

		const [[areaItemsMap, situationsMap, situationSkillsMap, skillsList], referencesMap] =
			await Promise.all([
				redis()
					.pipeline()
					.json.get(
						`${GBP.master}:masterAreaItemMap`,
						...Array.from(areaItemIds).map((id) => `$.entries.${id}`),
					)
					.json.get(
						`${GBP.master}:masterCharacterSituationMap`,
						...Array.from(situationIds).map((id) => `$.entries.${id}`),
					)
					.json.get(
						`${GBP.master}:masterSituationSkillMap`,
						...Array.from(situationIds).map((id) => `$.entries.${id}`),
					)
					.json.get(`${GBP.master}:masterSkillList`, "$.entries")
					.exec<
						[
							Record<`$.entries.${number}`, [MasterAreaItem]>,
							Record<`$.entries.${number}`, [MasterCharacterSituation]>,
							Record<`$.entries.${number}`, [MasterSituationSkill]>,
							[MasterSkill[]],
						]
					>(),
				db()
					.query.trackerReferences.findMany({
						columns: { kind: true, id: true, data: true },
						where: {
							OR: uniqBy(users, ({ reference: { kind, id } }) => `${kind}:${id}`).map(
								({ reference }) => reference,
							),
						},
					})
					.then((references) =>
						Object.fromEntries(references.map(({ kind, id, data }) => [`${kind}:${id}`, data])),
					),
			]);

		const skills = new Map(
			skillsList[0].map((skill) => [`${skill.id}:${skill.level}` as const, skill]),
		);

		const values = [] as Tracker.NewSnapshotTopProfile[];
		for (let idx = 0; idx < users.length; idx += 1) {
			const user = users[idx];
			const profile = profiles.get(user.uid)!;
			const reference = referencesMap[`${user.reference.kind}:${user.reference.id}`];

			let avatar = {} as MessageInitShape<typeof TrackerProfileAvatarSchema>;
			if (profile.userProfileSituation) {
				const { situationId, illust } = profile.userProfileSituation;
				const [situation] = situationsMap[`$.entries.${situationId}`];
				avatar = {
					situationId,
					illust,
					characterId: situation.characterId,
					bandId: GbpBandByCharacter[situation.characterId as GbpCharacter],
					rarity: situation.rarity,
					attribute: situation.attribute,
					prefix: situation.prefix,
					resourceSetName: situation.resourceSetName,
				};
			}

			const areaItems =
				profile.enabledUserAreaItems?.entries
					.map(({ areaItemId }) => areaItemsMap[`$.entries.${areaItemId}`][0])
					.sort(
						(a, b) =>
							a.targetBandIds.length - b.targetBandIds.length ||
							a.targetBandIds[0] - b.targetBandIds[0],
					) ?? [];

			const members = [] as MessageInitShape<typeof TrackerProfileBandMemberSchema>[];
			if (profile.mainDeckUserSituations?.entries) {
				for (const value of profile.mainDeckUserSituations.entries) {
					const [situation] = situationsMap[`$.entries.${value.situationId}`];
					const [situationSkill] = situationSkillsMap[`$.entries.${situation.situationSkillId}`];

					const bandId = GbpBandByCharacter[situation.characterId as GbpCharacter];
					const areaItemsMultiplier = {
						performance: 1,
						technique: 1,
						visual: 1,
					} satisfies MessageInitShape<typeof MasterSituationParameterSchema>;
					for (const areaItem of areaItems) {
						if (
							areaItem.targetBandIds.includes(bandId) &&
							areaItem.targetAttributes.includes(situation.attribute)
						) {
							areaItemsMultiplier.performance += areaItem.performance / 100;
							areaItemsMultiplier.technique += areaItem.technique / 100;
							areaItemsMultiplier.visual += areaItem.visual / 100;
						}
					}

					let eventPointBonus = 0;
					const eventPowerBonus = {
						performance: 0,
						technique: 0,
						visual: 0,
					} satisfies MessageInitShape<typeof MasterSituationParameterSchema>;
					if (reference.metadata.case && reference.metadata.case !== "monthly") {
						const { data } = reference.metadata.value;
						if (data) {
							let attributeBonus = 0;
							for (const { attribute, percent } of data.attributes) {
								if (situation.attribute === attribute) {
									attributeBonus = percent;
									break;
								}
							}

							let characterBonus = 0;
							for (const { characterId, percent } of data.characters) {
								if (situation.characterId === characterId) {
									characterBonus = percent;
									break;
								}
							}

							let matchBonus = 0;
							if (attributeBonus && characterBonus) {
								if (data.eventAttributeAndCharacterBonus?.pointPercent)
									matchBonus = data.eventAttributeAndCharacterBonus.pointPercent;
							}

							let memberBonus = 0;
							if (data.members) {
								for (let k in data.members.entries) {
									const { situationId, percent } = data.members.entries[k];
									if (value.situationId === situationId) {
										memberBonus = percent;
										break;
									}
								}
							}

							let limitBreakBonus = 0;
							if (value.limitBreakRank > 0 && data.limitBreaks?.entries) {
								limitBreakBonus =
									data.limitBreaks.entries[situation.rarity].entries[value.limitBreakRank].percent;
							}

							const totalBonus =
								attributeBonus + characterBonus + matchBonus + memberBonus + limitBreakBonus;
							eventPointBonus += totalBonus;

							if (data.eventAttributeAndCharacterBonus?.parameterPercent) {
								eventPowerBonus.performance += totalBonus;
								eventPowerBonus.technique += totalBonus;
								eventPowerBonus.visual += totalBonus;
								if ("eventCharacterParameterBonus" in data && data.eventCharacterParameterBonus) {
									eventPowerBonus.performance += data.eventCharacterParameterBonus.performance;
									eventPowerBonus.technique += data.eventCharacterParameterBonus.technique;
									eventPowerBonus.visual += data.eventCharacterParameterBonus.visual;
								}
							}
						}
					}

					members.push({
						value,
						power: situation.parameterMap[value.level],
						skill: skills.get(`${situationSkill.skillId}:${value.skillLevel}`),
						skillName: situationSkill.name,
						characterId: situation.characterId,
						bandId,
						rarity: situation.rarity,
						attribute: situation.attribute,
						prefix: situation.prefix,
						resourceSetName: situation.resourceSetName,

						eventPointBonus,
						powerBonus: {
							card: {
								performance: value.userAppendParameter?.performance,
								technique: value.userAppendParameter?.technique,
								visual: value.userAppendParameter?.visual,
							},
							potential: {
								performance: value.userAppendParameter?.characterPotentialPerformance,
								technique: value.userAppendParameter?.characterPotentialTechnique,
								visual: value.userAppendParameter?.characterPotentialVisual,
							},
							mission: {
								performance: value.userAppendParameter?.characterBonusPerformance,
								technique: value.userAppendParameter?.characterBonusTechnique,
								visual: value.userAppendParameter?.characterBonusVisual,
							},

							areaItemsMultiplier,
							event: eventPowerBonus,
						},
					});
				}
			}

			const data = create(TrackerProfileSchema, {
				uid: user.uid,
				name: profile.userName,
				level: profile.rank,
				introduction: profile.introduction,
				titles: profile.userProfileDegreeMap
					? Object.values(profile.userProfileDegreeMap.entries).map(({ degreeId }) => degreeId)
					: undefined,
				avatar,
				band: { name: profile.mainUserDeck?.deckName, members, areaItems },
			});

			values.push({
				id: createId(),
				uid: user.uid,
				data,
				hash: xxhash.h32Raw(toBinary(TrackerProfileSchema, data)),
			});
		}

		const result = await db()
			.insert(trackerSnapshotsTopProfiles)
			.values(values)
			.onConflictDoUpdate({
				target: [trackerSnapshotsTopProfiles.uid, trackerSnapshotsTopProfiles.hash],
				set: {
					uid: sql.raw(`excluded.${trackerSnapshotsTopProfiles.uid.name}`),
				},
			})
			.returning({
				id: trackerSnapshotsTopProfiles.id,
				uid: trackerSnapshotsTopProfiles.uid,
			});

		const lookupProfile = new Map(result.map(({ id, uid }) => [uid, id]));
		const update = ({ top, uid }: (typeof users)[number]) =>
			db()
				.update(trackerSnapshotsTop)
				.set({ profileId: lookupProfile.get(uid) })
				.where(eq(trackerSnapshotsTop.id, top));

		await db().batch(users.map(update) as [ReturnType<typeof update>]);
	},
});
