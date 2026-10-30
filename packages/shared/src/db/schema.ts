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

export const GbpCharacterBand = {
	[GbpCharacter["Kasumi Toyama"]]: GbpBand["Poppin'Party"],
	[GbpCharacter["Tae Hanazono"]]: GbpBand["Poppin'Party"],
	[GbpCharacter["Rimi Ushigome"]]: GbpBand["Poppin'Party"],
	[GbpCharacter["Saya Yamabuki"]]: GbpBand["Poppin'Party"],
	[GbpCharacter["Arisa Ichigaya"]]: GbpBand["Poppin'Party"],
	[GbpCharacter["Ran Mitake"]]: GbpBand.Afterglow,
	[GbpCharacter["Moca Aoba"]]: GbpBand.Afterglow,
	[GbpCharacter["Himari Uehara"]]: GbpBand.Afterglow,
	[GbpCharacter["Tomoe Udagawa"]]: GbpBand.Afterglow,
	[GbpCharacter["Tsugumi Hazawa"]]: GbpBand.Afterglow,
	[GbpCharacter["Kokoro Tsurumaki"]]: GbpBand["Hello, Happy World!"],
	[GbpCharacter["Kaoru Seta"]]: GbpBand["Hello, Happy World!"],
	[GbpCharacter["Hagumi Kitazawa"]]: GbpBand["Hello, Happy World!"],
	[GbpCharacter["Kanon Matsubara"]]: GbpBand["Hello, Happy World!"],
	[GbpCharacter["Misaki Okusawa"]]: GbpBand["Hello, Happy World!"],
	[GbpCharacter["Aya Maruyama"]]: GbpBand["Pastel＊Palettes"],
	[GbpCharacter["Hina Hikawa"]]: GbpBand["Pastel＊Palettes"],
	[GbpCharacter["Chisato Shirasagi"]]: GbpBand["Pastel＊Palettes"],
	[GbpCharacter["Maya Yamato"]]: GbpBand["Pastel＊Palettes"],
	[GbpCharacter["Eve Wakamiya"]]: GbpBand["Pastel＊Palettes"],
	[GbpCharacter["Yukina Minato"]]: GbpBand.Roselia,
	[GbpCharacter["Sayo Hikawa"]]: GbpBand.Roselia,
	[GbpCharacter["Lisa Imai"]]: GbpBand.Roselia,
	[GbpCharacter["Ako Udagawa"]]: GbpBand.Roselia,
	[GbpCharacter["Rinko Shirokane"]]: GbpBand.Roselia,
	[GbpCharacter["Mashiro Kurata"]]: GbpBand.Morfonica,
	[GbpCharacter["Toko Kirigaya"]]: GbpBand.Morfonica,
	[GbpCharacter["Nanami Hiromachi"]]: GbpBand.Morfonica,
	[GbpCharacter["Tsukushi Futaba"]]: GbpBand.Morfonica,
	[GbpCharacter["Rui Yashio"]]: GbpBand.Morfonica,
	[GbpCharacter.LAYER]: GbpBand["RAISE A SUILEN"],
	[GbpCharacter.LOCK]: GbpBand["RAISE A SUILEN"],
	[GbpCharacter.MASKING]: GbpBand["RAISE A SUILEN"],
	[GbpCharacter.PAREO]: GbpBand["RAISE A SUILEN"],
	[GbpCharacter["CHU²"]]: GbpBand["RAISE A SUILEN"],
	[GbpCharacter["Tomori Takamatsu"]]: GbpBand["MyGO!!!!!"],
	[GbpCharacter["Anon Chihaya"]]: GbpBand["MyGO!!!!!"],
	[GbpCharacter["Rana Kaname"]]: GbpBand["MyGO!!!!!"],
	[GbpCharacter["Soyo Nagasaki"]]: GbpBand["MyGO!!!!!"],
	[GbpCharacter["Taki Shina"]]: GbpBand["MyGO!!!!!"],
} satisfies Record<GbpCharacter, GbpBand>;

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
		previousId: integer(),

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
