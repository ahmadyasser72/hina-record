import {
	AbortTaskRunError,
	metadata,
	schedules,
	schemaTask,
	tags,
} from "@trigger.dev/sdk";
import { groupBy, isEqual, mapValues, omit, pick } from "es-toolkit";
import z from "zod";

import { bangDream, type GbpCredentials } from "#gbp/fetch";
import type {
	MapKeyUint32ValueUint32,
	UserCharacterRankMap,
	UserDeckTotalRatingMap,
	UserHighScoreRating,
	UserMusicClearInfoMap,
} from "#gbp/gen/profile_pb";
import { dayjs, GBP_TIME_ZONE } from "#lib/date";
import { db, GBP, redis } from "#lib/db";
import {
	GbpBand,
	GbpCharacter,
	profileSnapshots,
	type MusicClear,
	type NewProfileSnapshot,
	type ProfileSnapshot,
} from "#lib/db/schema";

import "zod/compile";

export const updateProfiles = schedules.task({
	id: "update-profiles",
	cron: { pattern: "50 23 * * *", timezone: GBP_TIME_ZONE },
	run: async ({ timestamp }) => {
		const [uids, version] = await redis()
			.pipeline()
			.smembers(GBP.players)
			.get(GBP.version)
			.exec<[number[], string]>();
		if (!version) return;

		const now = dayjs.tz(timestamp).startOf("hour").add(1, "hour");
		const today = now.format("YYYY-MM-DD");
		const grouped = groupBy(uids, (_, idx) => idx % 24);
		await updateProfile.batchTrigger(
			Object.entries(grouped).map(([hour, uids]) => ({
				payload: { uids, today, version },
				options: { delay: now.add(Number(hour), "hours").toDate() },
			})),
		);
	},
});

const updateProfile = schemaTask({
	id: "update-profile",
	schema: z.object({
		uids: z.array(z.coerce.string()),
		today: z.iso.date(),
		version: z.string(),
	}),

	concurrency: { total: 1 },
	retry: { maxAttempts: 1 },

	onStartAttempt: async ({ ctx }) => {
		const credentials = await redis().hgetall(GBP.credentials);
		if (!credentials)
			throw new AbortTaskRunError("BanG Dream credentials are missing.");

		ctx.task.credentials = credentials;
	},
	onComplete: async ({ ctx }) => {
		await redis().hset(GBP.credentials, {
			token: (ctx.task.credentials as GbpCredentials).token,
		});
	},

	run: async ({ uids, today, version }, { ctx }) => {
		const credentials = ctx.task.credentials as GbpCredentials;
		const snapshots = [] as NewProfileSnapshot[];
		for (const uid of uids.map(String)) {
			const profile = await bangDream.profile(version, credentials, uid);
			credentials.token = profile.response.token;

			const { data, hash } = profile;
			snapshots.push({
				uid,
				snapshotDate: today,
				proto: data,
				hash,

				username: data.userName,
				introduction: data.introduction,
				rank: data.rank,
				bandRank: parseBandRank(data.bandRankMap),
				characterRank: parseCharacterRank(data.userCharacterRankMap),
				deckRating: parseDeckRating(data.userDeckTotalRatingMap),
				highScoreRating: parseHighScoreRating(data.userHighScoreRating),
				musicClear: parseMusicClear(data.userMusicClearInfoMap),
				profileCard: data.userProfileSituation
					? pick(data.userProfileSituation, ["situationId", "illust"])
					: null,
				stageChallenge: parseStageChallenge(
					data.stageChallengeAchievementConditionsMap,
				),
			});
		}
		if (snapshots.length === 0) return;

		const changed = await db()
			.insert(profileSnapshots)
			.values(snapshots)
			.onConflictDoNothing()
			.returning({ id: profileSnapshots.id, uid: profileSnapshots.uid });
		if (changed.length === 0) return;

		await tags.add(`upsert_${changed.length}`);
		metadata.root.append("changed", changed);
		await redis().hset(
			GBP.playersLatest,
			Object.fromEntries(changed.map(({ uid, id }) => [uid, id])),
		);
	},
});

export const parseBandRank = (
	raw?: MapKeyUint32ValueUint32,
): Record<GbpBand, number> | null => {
	if (!raw?.entries || isEqual(raw.entries, {})) return null;

	return z.looseRecord(z.enum(GbpBand), z.number()).parse(raw.entries);
};

export const parseCharacterRank = (
	raw?: UserCharacterRankMap,
): Record<GbpCharacter, number> | null => {
	if (!raw?.entries || isEqual(raw.entries, {})) return null;

	return z
		.looseRecord(
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
		.looseRecord(
			z.enum(GbpBand),
			z.object({ rank: z.string(), score: z.number(), level: z.number() }),
		)
		.parse(raw.entries);
};

export const parseHighScoreRating = (
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
				z.object({
					musicId: z.number(),
					difficulty: z.enum(["easy", "normal", "hard", "expert", "special"]),
					rating: z.number(),
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
						.templateLiteral([
							z.enum(["cleared", "fullCombo", "allPerfect"]),
							"MusicCount",
						])
						.transform((k) => k.replace("MusicCount", "") as keyof MusicClear),
					z.number(),
				)
				.transform((value) =>
					pick(value, ["cleared", "fullCombo", "allPerfect"]),
				),
		)
		.parse(raw.entries);
};

export const parseStageChallenge = (
	raw?: MapKeyUint32ValueUint32,
): ProfileSnapshot["stageChallenge"] => {
	if (!raw?.entries || isEqual(raw.entries, {})) return null;

	return z.looseRecord(z.enum(GbpBand), z.number().catch(0)).parse(raw.entries);
};
