import { fromBinary, toBinary } from "@bufbuild/protobuf";
import { defineRelations } from "drizzle-orm";
import {
	customType,
	foreignKey,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";

import {
	UserProfileSchema,
	type UserProfile,
} from "@hina-record/shared/gbp/gen/profile_pb";

export enum GbpBand {
	"Poppin'Party" = 1,
	Afterglow = 2,
	"Hello, Happy World!" = 3,
	"Pastel＊Palettes" = 4,
	Roselia = 5,
	"RAISE A SUILEN" = 18,
	Morfonica = 21,
	"MyGO!!!!!" = 45,
}

export enum GbpCharacter {
	"Kasumi Toyama" = 1,
	"Tae Hanazono" = 2,
	"Rimi Ushigome" = 3,
	"Saya Yamabuki" = 4,
	"Arisa Ichigaya" = 5,
	"Ran Mitake" = 6,
	"Moca Aoba" = 7,
	"Himari Uehara" = 8,
	"Tomoe Udagawa" = 9,
	"Tsugumi Hazawa" = 10,
	"Kokoro Tsurumaki" = 11,
	"Kaoru Seta" = 12,
	"Hagumi Kitazawa" = 13,
	"Kanon Matsubara" = 14,
	"Misaki Okusawa" = 15,
	"Aya Maruyama" = 16,
	"Hina Hikawa" = 17,
	"Chisato Shirasagi" = 18,
	"Maya Yamato" = 19,
	"Eve Wakamiya" = 20,
	"Yukina Minato" = 21,
	"Sayo Hikawa" = 22,
	"Lisa Imai" = 23,
	"Ako Udagawa" = 24,
	"Rinko Shirokane" = 25,
	"Mashiro Kurata" = 26,
	"Toko Kirigaya" = 27,
	"Nanami Hiromachi" = 28,
	"Tsukushi Futaba" = 29,
	"Rui Yashio" = 30,
	LAYER = 31,
	LOCK = 32,
	MASKING = 33,
	PAREO = 34,
	"CHU²" = 35,
	"Tomori Takamatsu" = 36,
	"Anon Chihaya" = 37,
	"Rana Kaname" = 38,
	"Soyo Nagasaki" = 39,
	"Taki Shina" = 40,
}

export type MusicDifficulty = "easy" | "normal" | "hard" | "expert" | "special";

export interface HighScoreRating {
	musicId: number;
	difficulty: string;
	rating: number;
}

export interface DeckRating {
	rank: string;
	score: number;
	level: number;
}

export interface MusicClear {
	cleared: number;
	fullCombo: number;
	allPerfect: number;
}

const protoProfile = customType<{
	data: UserProfile;
	driverOutput: ArrayBuffer;
	configRequired: false;
}>({
	dataType: () => "blob",
	fromDriver: (buffer) => fromBinary(UserProfileSchema, Buffer.from(buffer)),
	toDriver: (value) => toBinary(UserProfileSchema, value),
});

export const profileSnapshots = sqliteTable(
	"profile_snapshots",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		uid: text("uid").notNull(),
		snapshotDate: text("snapshot_date").notNull(),

		username: text().notNull(),
		rank: integer().notNull(),
		introduction: text().notNull(),
		profileCard: text({ mode: "json" }).$type<{
			situationId: number;
			illust: string;
		}>(),
		bandRank: text({ mode: "json" }).$type<Record<GbpBand, number>>(),
		characterRank: text({ mode: "json" }).$type<Record<GbpCharacter, number>>(),
		highScoreRating: text({ mode: "json" }).$type<
			Record<GbpBand | 0, HighScoreRating[]>
		>(),
		deckRating: text({ mode: "json" }).$type<Record<GbpBand, DeckRating>>(),
		stageChallenge: text({ mode: "json" }).$type<Record<GbpBand, number>>(),
		musicClear: text({ mode: "json" }).$type<
			Record<MusicDifficulty, MusicClear>
		>(),

		proto: protoProfile().notNull(),
		hash: text().notNull(),
	},
	(t) => [unique().on(t.snapshotDate, t.uid), unique().on(t.uid, t.hash)],
);

export const SNAPSHOT_CHANGES = [
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
] as const;
export type SnapshotChange = (typeof SNAPSHOT_CHANGES)[number];

export const profileSnapshotChanges = sqliteTable(
	"profile_snapshot_changes",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		uid: text("uid").notNull(),
		snapshotDate: text("snapshot_date").notNull(),
		value: text().notNull().$type<SnapshotChange>(),
	},
	(t) => [
		foreignKey({
			columns: [t.uid, t.snapshotDate],
			foreignColumns: [profileSnapshots.uid, profileSnapshots.snapshotDate],
		}),
	],
);

export type ProfileSnapshot = typeof profileSnapshots.$inferSelect;
export type NewProfileSnapshot = typeof profileSnapshots.$inferInsert;

export const relations = defineRelations(
	{ profileSnapshots, profileSnapshotChanges },
	(r) => ({
		profileSnapshots: {
			changes: r.many.profileSnapshotChanges({
				from: [r.profileSnapshots.uid, r.profileSnapshots.snapshotDate],
				to: [
					r.profileSnapshotChanges.uid,
					r.profileSnapshotChanges.snapshotDate,
				],
			}),
		},
	}),
);
