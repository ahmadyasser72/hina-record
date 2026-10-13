import { Redis } from "@upstash/redis";
import { once } from "es-toolkit";

export const redis = once(() => {
	const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
	if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN)
		throw new Error("Redis credentials are missing.");

	return new Redis({
		url: UPSTASH_REDIS_REST_URL,
		token: UPSTASH_REDIS_REST_TOKEN,
	});
});

export const GBP = {
	version: "gbp:version",
	credentials: "gbp:credentials",
	credentialsRequest: "gbp:credentials:request",
	players: "gbp:players",
	playersLatest: "gbp:players:latest",
	maintenance: "gbp:maintenance",
} as const;
