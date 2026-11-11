import { create, toJson } from "@bufbuild/protobuf";
import { dayjs } from "@hina-record/shared/date";
import { db, GBP, redis } from "@hina-record/shared/db";
import { type Tracker, trackerReferences } from "@hina-record/shared/db/schema";
import { TrackerProtoSchema, type TrackerType } from "@hina-record/shared/db/types";
import {
	type SuiteMasterGetResponse,
	SuiteMasterGetResponseSchema,
} from "@hina-record/shared/gbp/gen/suite_master_pb";
import { TrackerMetadataSchema } from "@hina-record/shared/gbp/gen/tracker_metadata_pb";
import { AbortTaskRunError, metadata, schedules, tags } from "@trigger.dev/sdk";
import { once } from "es-toolkit";
import { pick } from "es-toolkit/fp";
import { camelCase } from "es-toolkit/string";

import { bangDream, type GbpCredentials } from "#root/fetch.ts";

export const updateMasterData = schedules.task({
	id: "update-master-data",
	cron: "0 */12 * * *",
	run: async ({ timestamp }) => {
		const [credentials, version, hashes] = await redis()
			.pipeline()
			.hgetall(GBP.credentials.static)
			.get(GBP.version)
			.hget(GBP.responses, GBP.hash.master)
			.exec<[GbpCredentials | null, string | null, { [GBP.hash.master]: number | null } | null]>();
		if (!version) return;
		else if (!credentials) throw new AbortTaskRunError("BanG Dream credentials are missing.");

		metadata.set("hash", hashes);

		const master = await bangDream.master(version, credentials);
		await tags.add(`master_${master.response.hash}`);
		if (master.response.hash === hashes?.[GBP.hash.master]) {
			await tags.add("master_unchanged");
			return;
		}

		const now = dayjs(timestamp);
		const references = [] as Tracker.NewReference[];

		const { masterEventMap, masterMusicList, masterMonthlyRankingList } = master.data;
		const musicMap = once(
			() => new Map(masterMusicList?.entries.map((music) => [music.id, music])),
		);
		const dataKey = {
			challenge: "masterChallengeEventMap",
			versus: "masterVersusEventMap",
			liveTry: "masterLiveTryEventMap",
			missionLive: "masterMissionLiveEventMap",
			festival: "masterFestivalEventMap",
			medley: "masterMedleyEventMap",
		} satisfies Record<Exclude<TrackerType, "monthly">, keyof SuiteMasterGetResponse>;

		if (masterEventMap) {
			for (const id in masterEventMap.entries) {
				const event = masterEventMap.entries[id];

				const [startAt, endAt] = [event.startAt, event.endAt].map(Number).map((t) => new Date(t));
				if (now.isAfter(startAt)) continue;

				const type = camelCase(event.type) as Exclude<TrackerType, "monthly">;
				const data = create(TrackerMetadataSchema, {
					rankingPath: (() => {
						let typ = event.type;
						if (event.type === "live_try") typ = "livetry";
						else if (event.type === "mission_live") typ = "mission";
						return `/event/${id}/${typ}/ranking`;
					})(),
				});

				const entries = master.data[dataKey[type]]?.entries;
				if (!entries) continue;

				const raw = entries[id];
				const musics = (() => {
					if ("musics" in raw && raw.musics.length > 0 && musicMap().size > 0) {
						return raw.musics.map(({ id }) => musicMap().get(id)!);
					}
				})();

				// @ts-expect-error trust me
				data.metadata = {
					case: type,
					// @ts-expect-error its correct trust
					value: create(TrackerProtoSchema[type], { event, data: raw, musics }),
				};

				references.push({
					id: Number(id),
					kind: "event",
					name: event.name,
					type,
					startAt,
					endAt,
					data,
				});
			}
		}

		if (masterMonthlyRankingList) {
			for (const monthly of masterMonthlyRankingList.entries) {
				const [startAt, endAt] = [monthly.startAt, monthly.endAt]
					.map(Number)
					.map((t) => new Date(t));
				if (now.isSame(startAt, "month") && now.isBefore(startAt)) {
					references.push({
						id: monthly.id,
						kind: "monthly",
						name: monthly.name,
						type: "monthly",
						startAt,
						endAt,
						data: create(TrackerMetadataSchema, {
							metadata: { case: "monthly", value: monthly },
							rankingPath: `/monthlyranking/${monthly.id}/ranking`,
						}),
					});
				}
			}
		}

		const updateRedis = () =>
			redis()
				.pipeline()
				.hset(GBP.responses, { [GBP.hash.master]: master.response.hash })
				.json.mset(
					...Object.entries(toJson(SuiteMasterGetResponseSchema, master.data)).map(
						([key, value]) => ({
							key: `${GBP.master}:${key}`,
							path: "$",
							value,
						}),
					),
				)
				.exec();

		metadata.set("reference", references.map(pick(["kind", "id", "name"])));

		await (references.length > 0
			? Promise.all([
					db().insert(trackerReferences).values(references).onConflictDoNothing(),
					updateRedis(),
				])
			: updateRedis());
	},
});
