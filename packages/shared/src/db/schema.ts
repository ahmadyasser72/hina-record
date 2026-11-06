import { defineRelations } from "drizzle-orm";
import {
	blob,
	foreignKey,
	integer,
	snakeCase,
	text,
	unique,
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

export const GbpCharactersByBand = {
	[GbpBand["Poppin'Party"]]: [
		GbpCharacter["Kasumi Toyama"],
		GbpCharacter["Tae Hanazono"],
		GbpCharacter["Rimi Ushigome"],
		GbpCharacter["Saya Yamabuki"],
		GbpCharacter["Arisa Ichigaya"],
	],
	[GbpBand.Afterglow]: [
		GbpCharacter["Ran Mitake"],
		GbpCharacter["Moca Aoba"],
		GbpCharacter["Himari Uehara"],
		GbpCharacter["Tomoe Udagawa"],
		GbpCharacter["Tsugumi Hazawa"],
	],
	[GbpBand["Hello, Happy World!"]]: [
		GbpCharacter["Kokoro Tsurumaki"],
		GbpCharacter["Kaoru Seta"],
		GbpCharacter["Hagumi Kitazawa"],
		GbpCharacter["Kanon Matsubara"],
		GbpCharacter["Misaki Okusawa"],
	],
	[GbpBand["Pastel＊Palettes"]]: [
		GbpCharacter["Aya Maruyama"],
		GbpCharacter["Hina Hikawa"],
		GbpCharacter["Chisato Shirasagi"],
		GbpCharacter["Maya Yamato"],
		GbpCharacter["Eve Wakamiya"],
	],
	[GbpBand.Roselia]: [
		GbpCharacter["Yukina Minato"],
		GbpCharacter["Sayo Hikawa"],
		GbpCharacter["Lisa Imai"],
		GbpCharacter["Ako Udagawa"],
		GbpCharacter["Rinko Shirokane"],
	],
	[GbpBand.Morfonica]: [
		GbpCharacter["Mashiro Kurata"],
		GbpCharacter["Toko Kirigaya"],
		GbpCharacter["Nanami Hiromachi"],
		GbpCharacter["Tsukushi Futaba"],
		GbpCharacter["Rui Yashio"],
	],
	[GbpBand["RAISE A SUILEN"]]: [
		GbpCharacter.LAYER,
		GbpCharacter.LOCK,
		GbpCharacter.MASKING,
		GbpCharacter.PAREO,
		GbpCharacter["CHU²"],
	],
	[GbpBand["MyGO!!!!!"]]: [
		GbpCharacter["Tomori Takamatsu"],
		GbpCharacter["Anon Chihaya"],
		GbpCharacter["Rana Kaname"],
		GbpCharacter["Soyo Nagasaki"],
		GbpCharacter["Taki Shina"],
	],
} satisfies Record<GbpBand, GbpCharacter[]>;

export const GbpStageChallenge = {
	1: GbpBand["Poppin'Party"],
	2: GbpBand.Afterglow,
	3: GbpBand["Pastel＊Palettes"],
	4: GbpBand.Roselia,
	5: GbpBand["Hello, Happy World!"],
	6: GbpBand.Morfonica,
	7: GbpBand["RAISE A SUILEN"],
	169: 169,
	170: 170,
} satisfies Record<number, GbpBand | number>;

export interface HighScoreRating {
	music: { id: number; title: string; jacketImage: string };
	difficulty: string;
	rating: number;
}

export interface DeckRating {
	rank: string;
	score: number;
	level: number;
}

export const MusicDifficulty = [
	"easy",
	"normal",
	"hard",
	"expert",
	"special",
] as const;
export type MusicDifficulty = (typeof MusicDifficulty)[number];
export const MusicClearKind = ["cleared", "fullCombo", "allPerfect"] as const;
export type MusicClearKind = (typeof MusicClearKind)[number];
export type MusicClear = Record<MusicClearKind, number | null>;

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
		highScoreRating: text({ mode: "json" }).$type<
			Record<GbpBand | 0, HighScoreRating[]>
		>(),
		deckRating: text({ mode: "json" }).$type<Record<GbpBand, DeckRating>>(),
		stageChallenge: text({ mode: "json" }).$type<Record<number, number>>(),
		musicClear: text({ mode: "json" }).$type<
			Record<MusicDifficulty, MusicClear>
		>(),

		proto: blob({ mode: "buffer" }).notNull(),
		hash: text().notNull(),
	},
	(t) => [
		unique().on(t.timestamp, t.uid),
		unique().on(t.uid, t.hash),
		foreignKey({ columns: [t.previousId], foreignColumns: [t.id] }),
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
export type NewProfileSnapshotChange =
	typeof profileSnapshotChanges.$inferInsert;

export const relations = defineRelations(
	{ profileSnapshotChanges, profileSnapshots },
	(r) => ({
		profileSnapshots: {
			changes: r.many.profileSnapshotChanges({
				from: [r.profileSnapshots.timestamp, r.profileSnapshots.uid],
				to: [r.profileSnapshotChanges.timestamp, r.profileSnapshotChanges.uid],
			}),

			previous: r.one.profileSnapshots({
				from: [r.profileSnapshots.previousId],
				to: [r.profileSnapshots.id],
				optional: true,
			}),
			next: r.one.profileSnapshots({
				from: [r.profileSnapshots.id],
				to: [r.profileSnapshots.previousId],
				optional: true,
			}),
		},
	}),
);
