import { beforeAll, describe, test } from "bun:test";

import { fromBinary } from "@bufbuild/protobuf";
import { chunk, groupBy } from "es-toolkit";
import z, { ZodError } from "zod";

import { db, GBP, redis } from "@hina-record/shared/db";
import {
	type UserProfile,
	UserProfileSchema,
} from "@hina-record/shared/gbp/gen/profile_pb";
import {
	bestdori,
	parseBandRank,
	parseCharacterRank,
	parseDeckRating,
	parseHighScoreRating,
	parseMusicClear,
	parseStageChallenge,
} from "./update-profiles";

describe("parse", () => {
	const musics = {} as z.infer<typeof bestdori.schema.musics>;
	const latest = [] as UserProfile[];
	beforeAll(async () => {
		Object.assign(musics, await bestdori.musics());

		const uids = await redis()
			.zrange<number[]>(GBP.players, 0, -1, { withScores: true })
			.then((uids) =>
				groupBy(chunk(uids, 2), ([, lastUpdated]) => lastUpdated),
			);
		const snapshots = await db().query.profileSnapshots.findMany({
			columns: { proto: true },
			where: {
				OR: Object.entries(uids).map(([lastUpdated, uids]) => ({
					timestamp: { eq: new Date(Number(lastUpdated)) },
					uid: { in: uids.map(String) },
				})),
			},
		});
		latest.push(
			...snapshots.map(({ proto }) => fromBinary(UserProfileSchema, proto)),
		);
	});

	const tryParse = <K extends keyof UserProfile>(
		key: K,
		callback: (value: UserProfile[K]) => void,
	) => {
		let value: UserProfile | undefined;
		try {
			for (value of latest) callback(value[key]);
		} catch (error) {
			if (error instanceof ZodError) {
				console.log(z.prettifyError(error));
				console.log(value?.[key]);
			}

			throw error;
		}
	};

	test("parseBandRank", () => {
		tryParse("bandRankMap", parseBandRank);
	});

	test("parseCharacterRank", () => {
		tryParse("userCharacterRankMap", parseCharacterRank);
	});

	test("parseDeckRating", () => {
		tryParse("userDeckTotalRatingMap", parseDeckRating);
	});

	test("parseHighScoreRating", () => {
		tryParse("userHighScoreRating", (value) =>
			parseHighScoreRating(musics, value),
		);
	});

	test("parseMusicClear", () => {
		tryParse("userMusicClearInfoMap", parseMusicClear);
	});

	test("parseStageChallenge", () => {
		tryParse("stageChallengeAchievementConditionsMap", parseStageChallenge);
	});
});
