import { foreignKey, index, integer, snakeCase, text, unique } from "drizzle-orm/sqlite-core";

import { UserProfileSchema } from "#root/gbp/gen/profile_pb.ts";

import type {
	DeckRating,
	GbpBand,
	GbpCharacter,
	HighScoreRating,
	MusicClear,
	MusicDifficulty,
} from "./profile.types";
import { wrapProto } from "./proto";

export const profileSnapshots = snakeCase.table(
	"profile_snapshots",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		uid: text().notNull(),
		timestamp: integer({ mode: "timestamp_ms" }).notNull(),
		previousId: integer().unique(),

		username: text().notNull(),
		rank: integer().notNull(),
		introduction: text().notNull(),
		profileCard: text({ mode: "json" }).$type<{
			situationId: number;
			illust: string;
			resourceSetName: string;
		}>(),
		bandRank: text({ mode: "json" }).$type<Record<GbpBand, number>>(),
		characterRank: text({ mode: "json" }).$type<Record<GbpCharacter, number>>(),
		highScoreRating: text({ mode: "json" }).$type<Record<GbpBand | 0, HighScoreRating[]>>(),
		deckRating: text({ mode: "json" }).$type<Record<GbpBand, DeckRating>>(),
		stageChallenge: text({ mode: "json" }).$type<Record<number, number>>(),
		musicClear: text({ mode: "json" }).$type<Record<MusicDifficulty, MusicClear>>(),

		data: wrapProto(UserProfileSchema)().notNull(),
	},
	(t) => [
		unique().on(t.timestamp, t.uid),
		foreignKey({ columns: [t.previousId], foreignColumns: [t.id] }),
		index("profile_snapshots_uid_timestamp").on(t.uid, t.timestamp, t.id),
		index("profile_snapshots_previous").on(t.previousId),
	],
);

export const SnapshotChange = [
	"username",
	"rank",
	"introduction",
	"profileCard",
	"bandRank",
	"characterRank",
	"highScoreRating",
	"deckRating",
	"stageChallenge",
	"musicClear",
] as const satisfies (keyof typeof profileSnapshots.$inferSelect)[];
export type SnapshotChange = (typeof SnapshotChange)[number];

export const profileSnapshotChanges = snakeCase.table(
	"profile_snapshot_changes",
	{
		id: integer().primaryKey({ autoIncrement: true }),

		uid: text().notNull(),
		timestamp: integer({ mode: "timestamp_ms" }).notNull(),
		value: text().notNull().$type<SnapshotChange>(),
	},
	(t) => [
		foreignKey({
			columns: [t.timestamp, t.uid],
			foreignColumns: [profileSnapshots.timestamp, profileSnapshots.uid],
		}),
		unique().on(t.timestamp, t.uid, t.value),
	],
);

export type ProfileSnapshot = typeof profileSnapshots.$inferSelect;
export type NewProfileSnapshot = typeof profileSnapshots.$inferInsert;
export type ProfileSnapshotChange = typeof profileSnapshotChanges.$inferSelect;
export type NewProfileSnapshotChange = typeof profileSnapshotChanges.$inferInsert;
