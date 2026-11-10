import { Redis } from "@upstash/redis";
import { once } from "es-toolkit";

import type { Tracker } from "./schema";

export const redis = once(() => {
	const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
	if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN)
		throw new Error("Redis credentials are missing.");

	return createRedis(UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN);
});

export const createRedis = (url: string, token: string) => new Redis({ token, url });

export const GBP = {
	credentials: {
		static: "gbp:credentials",
		rolling: "gbp:credentials:rolling",
		request: (uid: string) => `gbp:credentials:${uid}:request`,
	},
	maintenance: "gbp:maintenance",
	master: "gbp:master",
	players: "gbp:players",
	responses: "gbp:responses",
	version: "gbp:version",
	hash: {
		master: "suite:master",
		profile: (uid: string) => `profile:${uid}`,
		ranking: ({ kind, id }: Pick<Tracker.Reference, "kind" | "id">) => ({
			full: `ranking:${kind}:${id}` as const,
			top: (musicId = 0) => `ranking:${kind}:${id}:top:${musicId}` as const,
			userDeck: (uid: string) => `ranking:${kind}:${id}:deck:${uid}` as const,
		}),
	},
} as const;
