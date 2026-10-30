import { Redis } from "@upstash/redis";
import { once } from "es-toolkit";

export const redis = once(() => {
	const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
	if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN)
		throw new Error("Redis credentials are missing.");

	return new Redis({
		token: UPSTASH_REDIS_REST_TOKEN,
		url: UPSTASH_REDIS_REST_URL,
	});
});

export const GBP = {
	credentials: "gbp:credentials",
	credentialsRequest: "gbp:credentials:request",
	maintenance: "gbp:maintenance",
	players: "gbp:players",
	version: "gbp:version",
} as const;
