import "zod/compile";
import { dayjs } from "@hina-record/shared/date";
import { db, GBP, redis } from "@hina-record/shared/db";
import {
	type NewProfileSnapshot,
	type NewProfileSnapshotChange,
	type ProfileSnapshot,
	profileSnapshotChanges,
	profileSnapshots,
	SnapshotChange,
} from "@hina-record/shared/db/schema";
import {
	GbpBand,
	GbpCharacter,
	GbpStageChallenge,
	type HighScoreRating,
	type MusicClear,
	MusicClearKind,
	MusicDifficulty,
} from "@hina-record/shared/db/schema/types";
import type {
	MapKeyUint32ValueUint32,
	UserCharacterRankMap,
	UserDeckTotalRatingMap,
	UserHighScoreRating,
	UserMusicClearInfoMap,
	UserProfile,
} from "@hina-record/shared/gbp/gen/profile_pb";
import type {
	MasterCharacterSituation,
	MasterMusicGetResponse,
} from "@hina-record/shared/gbp/gen/suite_master_pb";
import { AbortTaskRunError, schedules, schemaTask, tags } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-orm/zod";
import { chunk, isEqual, mapValues, omit, pick, shuffle } from "es-toolkit";
import z from "zod";

import { bangDream, type GbpCredentials } from "#root/fetch.ts";

export const updateProfiles = schedules.task({
	id: "schedule-update-profiles",
	cron: "0 0 * * *",
	retry: { maxAttempts: 1 },
	run: async ({ timestamp }) => {
		const [players, version] = await redis()
			.pipeline()
			.zrange(GBP.players, 0, -1, { withScores: true })
			.get(GBP.version)
			.exec<[number[], string]>();
		if (!version) return;

		const uids = chunk(players, 2).map(([uid, latest]) => ({
			latest: latest || undefined,
			value: uid.toString(),
		}));

		const now = dayjs(timestamp);
		const today = now.startOf("day").toDate();
		const previousSnapshots = await (async () => {
			const ids = uids.map(({ latest }) => latest).filter((id) => typeof id === "number");
			if (ids.length === 0) return;

			const get = (id: number) =>
				db().query.profileSnapshots.findFirst({
					columns: { data: false },
					where: { id: { lte: id }, timestamp: { lt: today } },
					orderBy: { id: "desc" },
				});

			return db()
				.batch(ids.map(get) as [ReturnType<typeof get>])
				.then((snapshots) =>
					Object.fromEntries(
						snapshots
							.filter((snapshot) => snapshot !== undefined)
							.map((snapshot) => [snapshot.uid, snapshot]),
					),
				);
		})();

		await updateProfile.batchTrigger(
			chunk(shuffle(uids), 100).map((uids, idx) => ({
				options: { delay: now.add(idx * 3, "minutes").toDate() },
				payload: {
					today,
					uids: uids.map(({ value }) => ({
						value,
						previous: previousSnapshots?.[value],
					})),
					version,
				},
			})),
		);
	},
});

export const updateProfile = schemaTask({
	id: "update-profile",
	schema: z.object({
		today: z.date(),
		uids: z.array(
			z.object({
				value: z.string(),
				previous: createSelectSchema(profileSnapshots).omit({ data: true }).optional(),
			}),
		),
		version: z.string(),
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

	run: async ({ uids, today, version }, { ctx }) => {
		const credentials = ctx.task.credentials as GbpCredentials;
		const hashes =
			(await redis().hmget<Partial<Record<string, number>>>(
				GBP.responses,
				...uids.map(({ value }) => `profile:${value}`),
			)) ?? {};

		const situationIds = new Set<number>();
		const profiles = new Map<string, UserProfile>();
		for (let idx = 0; idx < uids.length; idx += 1) {
			const uid = uids[idx];
			const profile = await bangDream.profile(version, credentials, uid.value);
			credentials.token = profile.response.token;

			const { data, response } = profile;
			const key = GBP.hash.profile(uid.value);
			if (hashes[key] === response.hash) continue;
			else hashes[key] = response.hash;

			profiles.set(uid.value, data);

			if (data.userProfileSituation?.situationId)
				situationIds.add(data.userProfileSituation.situationId);

			// if (data.mainDeckUserSituations?.entries) {
			// 	const e = data.mainDeckUserSituations.entries;
			// 	for (let idx = 0; idx < e.length; idx += 1) situationIds.add(e[idx].situationId);
			// }
		}

		const [musicsMap, situationsMap] = await Promise.all([
			redis()
				.json.get<[MasterMusicGetResponse[]]>(`${GBP.master}:masterMusicList`, "$.entries")
				.then((res) => new Map(res?.[0].map((music) => [music.id, music]))),
			redis().json.get<Record<`$.entries.${number}`, [MasterCharacterSituation]>>(
				`${GBP.master}:masterCharacterSituationMap`,
				...Array.from(situationIds).map((id) => `$.entries.${id}`),
			),
		]);

		const snapshots = [] as NewProfileSnapshot[];
		const changes = [] as NewProfileSnapshotChange[];
		for (let idx = 0; idx < uids.length; idx += 1) {
			const target = uids[idx];
			const profile = profiles.get(target.value);
			if (!profile) continue;

			const current = {
				uid: target.value,
				timestamp: today,
				previousId: target.previous?.id,
				data: profile,

				username: profile.userName,
				introduction: profile.introduction,
				rank: profile.rank,
				bandRank: parseBandRank(profile.bandRankMap),
				characterRank: parseCharacterRank(profile.userCharacterRankMap),
				deckRating: parseDeckRating(profile.userDeckTotalRatingMap),
				highScoreRating: parseHighScoreRating(musicsMap, profile.userHighScoreRating),
				musicClear: parseMusicClear(profile.userMusicClearInfoMap),
				profileCard: profile.userProfileSituation?.situationId
					? {
							...pick(profile.userProfileSituation, ["situationId", "illust"]),
							resourceSetName:
								situationsMap![`$.entries.${profile.userProfileSituation.situationId}`][0]
									.resourceSetName,
						}
					: null,
				stageChallenge: parseStageChallenge(profile.stageChallengeAchievementConditionsMap),
			} satisfies NewProfileSnapshot;
			snapshots.push(current);

			if (!target.previous) continue;
			changes.push(
				...SnapshotChange.filter(
					(change) => !isEqual(current[change], target.previous![change]),
				).map((value) => ({ timestamp: today, uid: target.value, value })),
			);
		}
		if (snapshots.length === 0) return;

		const [changed] = await db().batch([
			db()
				.insert(profileSnapshots)
				.values(snapshots)
				.onConflictDoUpdate({
					target: [profileSnapshots.timestamp, profileSnapshots.uid],
					set: Object.fromEntries(
						SnapshotChange.map((change) => [
							change,
							sql.raw(`excluded.${profileSnapshots[change].name}`),
						]),
					),
				})
				.returning({ id: profileSnapshots.id, uid: profileSnapshots.uid }),
			...(changes.length > 0
				? [db().insert(profileSnapshotChanges).values(changes).onConflictDoNothing()]
				: []),
		]);
		if (changed.length === 0) return;

		await tags.add(`upsert_${changed.length}`);
		await redis()
			.pipeline()
			.zadd(
				GBP.players,
				...(changed.map(({ uid, id }) => ({ member: uid, score: id })) as [
					{ member: string; score: number },
				]),
			)
			.hset(GBP.responses, hashes)
			.exec();
	},
});

export const parseBandRank = (raw?: MapKeyUint32ValueUint32): Record<GbpBand, number> | null => {
	if (!raw?.entries || isEqual(raw.entries, {})) return null;

	return z.record(z.enum(GbpBand), z.number()).parse(raw.entries);
};

export const parseCharacterRank = (
	raw?: UserCharacterRankMap,
): Record<GbpCharacter, number> | null => {
	if (!raw?.entries || isEqual(raw.entries, {})) return null;

	return z
		.record(
			z.enum(GbpCharacter),
			z.object({ rank: z.number() }).transform(({ rank }) => rank),
		)
		.parse(raw.entries);
};

export const parseDeckRating = (raw?: UserDeckTotalRatingMap): ProfileSnapshot["deckRating"] => {
	if (!raw?.entries || isEqual(raw.entries, {})) return null;

	return z
		.record(
			z.enum(GbpBand),
			z
				.object({ level: z.number(), rank: z.string(), score: z.number() })
				.catch(() => ({ level: 0, rank: "-", score: 0 })),
		)
		.parse(raw.entries);
};

export const parseHighScoreRating = (
	musicsMap: Map<number, MasterMusicGetResponse>,
	raw?: UserHighScoreRating,
): ProfileSnapshot["highScoreRating"] => {
	if (!raw) return null;
	const entries = omit(raw, ["$typeName", "$unknown"]);
	if (isEqual(entries, {})) return null;

	const {
		userPoppinPartyHighScoreMusicList = [],
		userAfterglowHighScoreMusicList = [],
		userHelloHappyWorldHighScoreMusicList = [],
		userPastelPalettesHighScoreMusicList = [],
		userRoseliaHighScoreMusicList = [],
		userRaiseASuilenHighScoreMusicList = [],
		userMorfonicaHighScoreMusicList = [],
		userMyGOScoreMusicList = [],
		userOtherHighScoreMusicList = [],
	} = mapValues(entries, (value) =>
		z
			.array(
				z
					.object({
						difficulty: z.enum(["easy", "normal", "hard", "expert", "special"]),
						musicId: z.number(),
						rating: z.number(),
					})
					.transform(({ musicId: id, ...value }) => {
						const music = musicsMap.get(id)!;
						return {
							music: { id, jacketImage: music.jacketImage, title: music.title },
							...value,
						} satisfies HighScoreRating;
					}),
			)
			.parse(value?.entries ?? []),
	);

	return {
		[GbpBand["Poppin'Party"]]: userPoppinPartyHighScoreMusicList,
		[GbpBand.Afterglow]: userAfterglowHighScoreMusicList,
		[GbpBand["Hello, Happy World!"]]: userHelloHappyWorldHighScoreMusicList,
		[GbpBand["Pastel＊Palettes"]]: userPastelPalettesHighScoreMusicList,
		[GbpBand.Roselia]: userRoseliaHighScoreMusicList,
		[GbpBand["RAISE A SUILEN"]]: userRaiseASuilenHighScoreMusicList,
		[GbpBand.Morfonica]: userMorfonicaHighScoreMusicList,
		[GbpBand["MyGO!!!!!"]]: userMyGOScoreMusicList,
		0: userOtherHighScoreMusicList,
	};
};

export const parseMusicClear = (raw?: UserMusicClearInfoMap): ProfileSnapshot["musicClear"] => {
	if (!raw?.entries || isEqual(raw.entries, {})) return null;

	return z
		.record(
			z.enum(["easy", "normal", "hard", "expert", "special"]),
			z
				.looseRecord(
					z
						.templateLiteral([z.enum(MusicClearKind), "MusicCount"])
						.transform((k) => k.replace("MusicCount", "") as MusicClearKind),
					z.number(),
				)
				.transform((value): MusicClear => pick(value, MusicClearKind)),
		)
		.transform((value) => {
			const hidden = new Set<MusicClearKind>();
			for (const kind of MusicClearKind) {
				if (MusicDifficulty.some((difficulty) => !!value[difficulty][kind])) continue;

				hidden.add(kind);
				for (const difficulty of MusicDifficulty) value[difficulty][kind] = null;
			}

			return hidden.size === MusicClearKind.length ? null : value;
		})
		.parse(raw.entries);
};

export const parseStageChallenge = (
	raw?: MapKeyUint32ValueUint32,
): ProfileSnapshot["stageChallenge"] => {
	if (!raw?.entries || isEqual(raw.entries, {})) return null;

	return z.record(z.enum(Object.keys(GbpStageChallenge)), z.number().catch(0)).parse(raw.entries);
};
