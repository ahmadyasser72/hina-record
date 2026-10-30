import { defineConfig } from "drizzle-kit";

const { DATABASE_URL, DATABASE_AUTH_TOKEN } = process.env;
if (!DATABASE_URL || !DATABASE_AUTH_TOKEN)
	throw new Error("Database credentials are missing.");

export default defineConfig({
	out: "./drizzle",
	schema: "./src/lib/db/schema.ts",
	dialect: "turso",
	dbCredentials: { url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN },
});
