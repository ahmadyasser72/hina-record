import { drizzle } from "drizzle-orm/libsql/http";
import { once } from "es-toolkit";

import { relations } from "./schema";

export const db = once(() => {
	const { DATABASE_URL, DATABASE_AUTH_TOKEN } = process.env;
	if (!DATABASE_URL || !DATABASE_AUTH_TOKEN) throw new Error("Database credentials are missing.");

	return createDB(DATABASE_URL, DATABASE_AUTH_TOKEN);
});

export const createDB = (url: string, authToken: string) =>
	drizzle({
		relations,
		connection: { authToken, url },
		jit: navigator.userAgent !== "Cloudflare-Workers",
	});

export { orderedId as createId } from "nope-id";

export * from "./redis";
