import { beforeAll, describe, test } from "bun:test";
import z, { ZodError } from "zod";

import { db, GBP, redis } from "@hina-record/shared/db";
import { type UserProfile } from "@hina-record/shared/gbp/gen/profile_pb";
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
		const snapshots = await db().query.profileSnapshots.findMany({
			columns: { proto: true },
			where: {
				id: {
					in: Object.values(
						z
							.record(z.string(), z.coerce.number())
							.parse(await redis().hgetall(GBP.playersLatest)),
					),
				},
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
