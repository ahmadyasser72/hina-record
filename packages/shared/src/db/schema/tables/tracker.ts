import {
	foreignKey,
	index,
	integer,
	primaryKey,
	snakeCase,
	text,
	unique,
} from "drizzle-orm/sqlite-core";

import { TrackerMetadataSchema } from "#root/gbp/gen/tracker_metadata_pb.ts";
import { TrackerProfileSchema } from "#root/gbp/gen/tracker_profile_pb.ts";
import { TrackerSnapshotSchema } from "#root/gbp/gen/tracker_snapshot_pb.ts";

import { wrapProto } from "./proto";
import type { TrackerKind, TrackerType } from "./tracker.types";

export const trackerReferences = snakeCase.table(
	"tracker_references",
	{
		kind: text().notNull().$type<TrackerKind>(),
		id: integer().notNull(),
		name: text().notNull(),
		type: text().notNull().$type<TrackerType>(),
		startAt: integer({ mode: "timestamp_ms" }).notNull(),
		endAt: integer({ mode: "timestamp_ms" }).notNull(),

		data: wrapProto(TrackerMetadataSchema)().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.kind, t.id] }),
		index("tracker_reference_timestamp").on(t.startAt, t.endAt),
	],
);

export const trackerSnapshots = snakeCase.table(
	"tracker_snapshots",
	{
		id: text().primaryKey(),
		trackerKind: text().notNull().$type<TrackerKind>(),
		trackerId: integer().notNull(),

		data: wrapProto(TrackerSnapshotSchema)(),
		timestamp: integer({ mode: "timestamp_ms" }).notNull(),
	},
	(t) => [
		foreignKey({
			columns: [t.trackerKind, t.trackerId],
			foreignColumns: [trackerReferences.kind, trackerReferences.id],
		}),
		unique().on(t.trackerKind, t.trackerId, t.timestamp),
		index("tracker_snapshot_sort").on(t.trackerKind, t.trackerId, t.id),
	],
);

export const trackerSnapshotsTop = snakeCase.table(
	"tracker_snapshots_top",
	{
		id: text().primaryKey(),
		trackerKind: text().notNull().$type<TrackerKind>(),
		trackerId: integer().notNull(),
		musicId: integer().notNull(),
		snapshotId: text().notNull(),

		uid: text().notNull(),
		name: text().notNull(),
		rank: integer().notNull(),
		point: integer().notNull(),
		pointGain: integer().notNull(),
		timestamp: integer({ mode: "timestamp_ms" }).notNull(),

		profileId: text(),
		sessionId: text(),
	},
	(t) => [
		foreignKey({
			columns: [t.trackerKind, t.trackerId],
			foreignColumns: [trackerReferences.kind, trackerReferences.id],
		}),
		foreignKey({
			columns: [t.snapshotId],
			foreignColumns: [trackerSnapshots.id],
		}),
		foreignKey({
			columns: [t.profileId],
			foreignColumns: [trackerSnapshotsTopProfiles.id],
		}),
		foreignKey({
			columns: [t.sessionId],
			foreignColumns: [trackerSnapshotsTopSessions.id],
		}),
		unique().on(t.trackerKind, t.trackerId, t.musicId, t.rank, t.uid, t.name, t.point),
	],
);

export const trackerSnapshotsTopProfiles = snakeCase.table(
	"tracker_snapshots_top_profiles",
	{
		id: text().primaryKey(),

		uid: text().notNull(),
		data: wrapProto(TrackerProfileSchema)().notNull(),
		hash: integer().notNull(),
	},
	(t) => [unique().on(t.uid, t.hash)],
);

export const trackerSnapshotsTopSessions = snakeCase.table(
	"tracker_snapshots_top_sessions",
	{
		id: text().primaryKey(),

		uid: text().notNull(),
		startAt: integer({ mode: "timestamp_ms" }).notNull(),
		endAt: integer({ mode: "timestamp_ms" }).notNull(),
		points: integer().notNull(),
		games: integer().notNull(),
	},
	(t) => [index("tracker_uid_sessions").on(t.uid, t.startAt, t.endAt)],
);

export const trackerSnapshotsToTop = snakeCase.table(
	"tracker_snapshots_to_top",
	{
		snapshotId: text().notNull(),
		topId: text().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.snapshotId, t.topId] }),
		foreignKey({
			columns: [t.snapshotId],
			foreignColumns: [trackerSnapshots.id],
		}),
		foreignKey({
			columns: [t.topId],
			foreignColumns: [trackerSnapshotsTop.id],
		}),
	],
);

export namespace Tracker {
	export type Reference = typeof trackerReferences.$inferSelect;
	export type NewReference = typeof trackerReferences.$inferInsert;
	export type Snapshot = typeof trackerSnapshots.$inferSelect;
	export type NewSnapshot = typeof trackerSnapshots.$inferInsert;
	export type SnapshotTop = typeof trackerSnapshotsTop.$inferSelect;
	export type NewSnapshotTop = typeof trackerSnapshotsTop.$inferInsert;
	export type SnapshotTopProfile = typeof trackerSnapshotsTopProfiles.$inferSelect;
	export type NewSnapshotTopProfile = typeof trackerSnapshotsTopProfiles.$inferInsert;
	export type SnapshotTopSession = typeof trackerSnapshotsTopSessions.$inferSelect;
	export type NewSnapshotTopSession = typeof trackerSnapshotsTopSessions.$inferInsert;
}
