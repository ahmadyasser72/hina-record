import { dayjs } from "@hina-record/shared/date";
import { db, GBP, redis } from "@hina-record/shared/db";
import type { RankingUserList } from "@hina-record/shared/gbp/gen/tracker_ranking_pb";
import { schedules, tags } from "@trigger.dev/sdk";

export const collectTracker = schedules.task({
	cron: "0 * * * *",
	id: "collect-tracker-uids",
	ttl: "1h",
	retry: { maxAttempts: 1 },

	run: async ({ timestamp }) => {
		const now = dayjs(timestamp).startOf("hour").add(1, "hour");
		const references = await db().query.trackerReferences.findMany({
			columns: {},
			where: {
				startAt: { lte: now.toDate() },
				endAt: { gte: now.add(30, "minutes").toDate() },
			},
			with: {
				snapshots: {
					columns: { data: true },
					where: { timestamp: { gte: now.subtract(1, "hour").toDate() } },
					orderBy: { id: "desc" },
				},
			},
		});
		if (references.length === 0) return;

		const uids = new Set<string>();
		const pushEntries = (list?: RankingUserList) => {
			if (!list) return;

			for (let idx = 0; idx < list.entries.length; idx += 1) {
				const user = list.entries[idx];
				if (user.rank <= 100) uids.add(user.uid);
			}
		};

		for (const { snapshots } of references) {
			const data = snapshots.at(0)?.data?.snapshot;
			if (!data) continue;

			pushEntries(data.value?.top);
			pushEntries(data.value?.border);
			if (
				data.value?.$typeName === "ChallengeRanking" ||
				data.value?.$typeName === "VersusRanking"
			) {
				for (const music of data.value.musics) {
					pushEntries(music.top);
					pushEntries(music.border);
				}
			} else if (data.value?.$typeName === "MedleyRanking") {
				pushEntries(data.value.topMusic);
				pushEntries(data.value.borderMusic);
			}
		}

		if (uids.size > 0) {
			const added = await redis().zadd(
				GBP.players,
				{ ch: true, gt: true },
				...(Array.from(uids).map((member) => ({ member, score: 0 })) as [
					{ member: string; score: number },
				]),
			);
			if (added) await tags.add(`added_${added}`);
		}
	},
});
