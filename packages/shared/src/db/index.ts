import { drizzle } from "drizzle-orm/libsql/http";
import { once } from "es-toolkit";

import { relations } from "./schema";

export const db = once(() => {
	const { DATABASE_URL, DATABASE_AUTH_TOKEN } = process.env;
	if (!DATABASE_URL || !DATABASE_AUTH_TOKEN)
		throw new Error("Database credentials are missing.");

	return drizzle({
		relations,
		connection: { url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN },
	});
});

export * from "./redis";
