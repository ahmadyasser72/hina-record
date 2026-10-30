import {
	AbortTaskRunError,
	schedules,
	schemaTask,
	tags,
} from "@trigger.dev/sdk";
import {
	chunk,
	groupBy,
	isEqual,
	mapValues,
	omit,
	pick,
	shuffle,
} from "es-toolkit";
import z from "zod";

import { dayjs, GBP_TIME_ZONE } from "@hina-record/shared/date";
import { db, GBP, redis } from "@hina-record/shared/db";
import {
	GbpBand,
	GbpCharacter,
	GbpStageChallenge,
	type HighScoreRating,
	type MusicClear,
	MusicClearKind,
	MusicDifficulty,
	type NewProfileSnapshot,
	type NewProfileSnapshotChange,
	type ProfileSnapshot,
	profileSnapshotChanges,
	profileSnapshots,
	SnapshotChange,
} from "@hina-record/shared/db/schema";
import type {
	MapKeyUint32ValueUint32,
	UserCharacterRankMap,
	UserDeckTotalRatingMap,
	UserHighScoreRating,
	UserMusicClearInfoMap,
} from "@hina-record/shared/gbp/gen/profile_pb";

import "zod/compile";
import { sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-orm/zod";

import { bangDream, type GbpCredentials } from "../fetch";

export const updateProfiles = schedules.task({
	cron: { pattern: "50 23 * * *", timezone: GBP_TIME_ZONE },
	id: "schedule-update-profiles",
	run: async ({ timestamp }) => {
		const [players, version] = await redis()
			.pipeline()
			.zrange(GBP.players, 0, -1, { withScores: true })
			.get(GBP.version)
			.exec<[number[], string]>();
		if (!version) return;

		const uids = chunk(players, 2).map(([uid, lastUpdated]) => ({
			lastUpdated: lastUpdated > 0 ? new Date(lastUpdated) : undefined,
			value: uid.toString(),
		}));

		const now = dayjs.tz(timestamp).startOf("hour").add(1, "hour");
		const today = now.startOf("day").toDate();
		const [cards, musics, previousSnapshots] = await Promise.all([
			bestdori.cards(),
			bestdori.musics(),
			(async () => {
				const withPrevious = uids.filter(
					(uid): uid is { value: string; lastUpdated: Date } =>
						uid.lastUpdated instanceof Date,
				);
				if (withPrevious.length === 0) return;

				return db()
					.query.profileSnapshots.findMany({
						columns: { proto: false },
						where: {
							OR: Object.entries(
								groupBy(withPrevious, ({ lastUpdated }) =>
									lastUpdated.toISOString(),
								),
							).map(([lastUpdated, uids]) => {
								const timestamp = new Date(lastUpdated);
								return {
									timestamp: isEqual(timestamp, today)
										? { lt: today }
										: { eq: timestamp },
									uid: { in: uids.map(({ value }) => value) },
								};
							}),
						},
						orderBy: { id: "desc" },
					})
					.then((snapshots) =>
						Object.fromEntries(
							snapshots.map((snapshot) => [snapshot.uid, snapshot]),
						),
					);
			})(),
		]);

		await updateProfile.batchTrigger(
			chunk(shuffle(uids), 100).map((uids, idx) => ({
				options: { delay: now.add(idx * 3, "minutes").toDate() },
				payload: {
					metadata: { cards, musics },
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

export const bestdori = {
	cards: async () => {
		const response = await fetch("https://bestdori.com/api/cards/all.5.json");
		return bestdori.schema.cards.parse(await response.json());
	},
	musics: async () => {
		const response = await fetch("https://bestdori.com/api/songs/all.5.json");
		return bestdori.schema.musics.parse(await response.json());
	},
	schema: {
		cards: z.record(z.number(), z.object({ resourceSetName: z.string() })),
		musics: z.record(
			z.number(),
			z.object({
				jacketImage: z.array(z.string()),
				musicTitle: z.array(z.string().nullable()),
			}),
		),
	},
};

export const updateProfile = schemaTask({
	id: "update-profile",
	schema: z.object({
		metadata: z.object(bestdori.schema),
		today: z.date(),
		uids: z.array(
			z.object({
				value: z.string(),
				previous: createSelectSchema(profileSnapshots)
					.omit({ proto: true })
					.optional(),
			}),
		),
		version: z.string(),
	}),
	concurrency: { total: 1 },
	retry: { maxAttempts: 1 },

	onComplete: async ({ ctx }) => {
		await redis().hset(GBP.credentials, {
			token: (ctx.task.credentials as GbpCredentials).token,
		});
	},
	onStartAttempt: async ({ ctx }) => {
		const credentials = await redis().hgetall(GBP.credentials);
		if (!credentials)
			throw new AbortTaskRunError("BanG Dream credentials are missing.");
		ctx.task.credentials = credentials;
	},

	run: async ({ uids, today, version, metadata }, { ctx }) => {
		const credentials = ctx.task.credentials as GbpCredentials;

		const snapshots = [] as NewProfileSnapshot[];
		const changes = [] as NewProfileSnapshotChange[];
		for (const { value: uid, previous } of uids) {
			const profile = await bangDream.profile(version, credentials, uid);
			credentials.token = profile.response.token;

			const { data, response } = profile;
			if (previous?.hash === response.hash) continue;

			const current = {
				uid,
				timestamp: today,
				previousId: previous?.id,
				proto: Buffer.from(response.bytes),
				hash: response.hash,

				username: data.userName,
				introduction: data.introduction,
				rank: data.rank,
				bandRank: parseBandRank(data.bandRankMap),
				characterRank: parseCharacterRank(data.userCharacterRankMap),
				deckRating: parseDeckRating(data.userDeckTotalRatingMap),
				highScoreRating: parseHighScoreRating(
					metadata.musics,
					data.userHighScoreRating,
				),
				musicClear: parseMusicClear(data.userMusicClearInfoMap),
				profileCard: data.userProfileSituation?.situationId
					? {
							...pick(data.userProfileSituation, ["situationId", "illust"]),
							resourceSetName:
								metadata.cards[data.userProfileSituation.situationId]
									.resourceSetName,
						}
					: null,
				stageChallenge: parseStageChallenge(
					data.stageChallengeAchievementConditionsMap,
				),
			} satisfies NewProfileSnapshot;
			snapshots.push(current);

			if (!previous) continue;
			changes.push(
				...SnapshotChange.filter(
					(change) => !isEqual(current[change], previous[change]),
				).map((value) => ({ timestamp: today, uid, value })),
			);
		}
		if (snapshots.length === 0) return;

		const [changed] = await db().batch([
			db()
				.insert(profileSnapshots)
				.values(snapshots)
				.onConflictDoUpdate({
					target: [profileSnapshots.timestamp, profileSnapshots.uid],
					set: {
						...Object.fromEntries(
							[...SnapshotChange, "hash" as const].map((change) => [
								change,
								sql.raw(`excluded.${profileSnapshots[change].name}`),
							]),
						),
					},
				})
				.returning({
					timestamp: profileSnapshots.timestamp,
					uid: profileSnapshots.uid,
				}),
			...(changes.length > 0
				? [
						db()
							.insert(profileSnapshotChanges)
							.values(changes)
							.onConflictDoNothing(),
					]
				: []),
		]);
		if (changed.length === 0) return;

		await tags.add(`upsert_${changed.length}`);
		await redis().zadd(
			GBP.players,
			...(changed.map(({ uid, timestamp }) => ({
				member: uid,
				score: timestamp.getTime(),
			})) as [{ member: string; score: number }]),
		);
	},
});

export const parseBandRank = (
	raw?: MapKeyUint32ValueUint32,
): Record<GbpBand, number> | null => {
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

export const parseDeckRating = (
	raw?: UserDeckTotalRatingMap,
): ProfileSnapshot["deckRating"] => {
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
	musics: z.infer<typeof bestdori.schema.musics>,
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
						const music = musics[id];
						return {
							music: {
								id,
								jacketImage: music.jacketImage[0],
								// biome-ignore lint/style/noNonNullAssertion: safe
								title: music.musicTitle[1]!,
							},
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

export const parseMusicClear = (
	raw?: UserMusicClearInfoMap,
): ProfileSnapshot["musicClear"] => {
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
				if (MusicDifficulty.some((difficulty) => !!value[difficulty][kind]))
					continue;

				hidden.add(kind);
				for (const difficulty of MusicDifficulty)
					value[difficulty][kind] = null;
			}

			return hidden.size === MusicClearKind.length ? null : value;
		})
		.parse(raw.entries);
};

export const parseStageChallenge = (
	raw?: MapKeyUint32ValueUint32,
): ProfileSnapshot["stageChallenge"] => {
	if (!raw?.entries || isEqual(raw.entries, {})) return null;

	return z
		.record(z.enum(Object.keys(GbpStageChallenge)), z.number().catch(0))
		.parse(raw.entries);
};
