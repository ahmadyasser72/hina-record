import { defineRelations } from "drizzle-orm";
import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

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

export const profileSnapshots = sqliteTable(
	"profile_snapshots",
	{
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

		json: text({ mode: "json" }).notNull().unique(),
	},
	(t) => [primaryKey({ columns: [t.uid, t.snapshotDate] })],
);

export type ProfileSnapshot = typeof profileSnapshots.$inferSelect;
export type NewProfileSnapshot = typeof profileSnapshots.$inferInsert;

export const relations = defineRelations({ profileSnapshots });
