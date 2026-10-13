import { beforeAll, describe, test } from "bun:test";
import { groupBy } from "es-toolkit";
import z, { ZodError } from "zod";

import { type UserProfile } from "#gbp/gen/profile_pb";
import { db, GBP, redis } from "#lib/db";
import {
	parseBandRank,
	parseCharacterRank,
	parseDeckRating,
	parseHighScoreRating,
	parseMusicClear,
	parseStageChallenge,
} from "./update-profiles";

describe("parse", () => {
	const latest = [] as UserProfile[];
	beforeAll(async () => {
		const lastUpdated = groupBy(
			Object.entries(
				z
					.record(z.string(), z.string())
					.parse(await redis().hgetall(GBP.playersLastUpdated)),
			),
			([, snapshotDate]) => snapshotDate,
		);

		const snapshots = await db().query.profileSnapshots.findMany({
			columns: { proto: true },
			where: {
				OR: Object.entries(lastUpdated).map(([snapshotDate, uids]) => ({
					uid: { in: uids.map(([uid]) => uid) },
					snapshotDate,
				})),
			},
		});
		latest.push(...snapshots.map(({ proto }) => proto));
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
		tryParse("userHighScoreRating", parseHighScoreRating);
	});

	test("parseMusicClear", () => {
		tryParse("userMusicClearInfoMap", parseMusicClear);
	});

	test("parseStageChallenge", () => {
		tryParse("stageChallengeAchievementConditionsMap", parseStageChallenge);
	});
});
