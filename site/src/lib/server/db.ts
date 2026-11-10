import {
	DATABASE_URL,
	DATABASE_AUTH_TOKEN,
	UPSTASH_REDIS_REST_URL,
	UPSTASH_REDIS_REST_TOKEN,
} from "$app/env/private";
import { createDB, createRedis } from "@hina-record/shared/db";

export const db = createDB(DATABASE_URL, DATABASE_AUTH_TOKEN);
export const redis = createRedis(UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN);
