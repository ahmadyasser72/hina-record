import { schedules, tags } from "@trigger.dev/sdk";
import z from "zod";

import { dayjs, GBP_TIME_ZONE } from "@hina-record/shared/date";
import { GBP, redis } from "@hina-record/shared/db";

import "zod/compile";

export const collectTracker = schedules.task({
	id: "collect-tracker-uids",
	cron: { pattern: "0 0 * * *", timezone: GBP_TIME_ZONE },
	run: async () => {
		const news = z
			.object({
				events: z.record(
					z.number(),
					z.object({
						startAt: z.array(z.coerce.number().nullable()),
						endAt: z.array(z.coerce.number().nullable()),
					}),
				),
			})
			.parse(
				await fetch("https://bestdori.com/api/news/dynamic/recent.json").then(
					(response) => response.json(),
				),
			);

		const active = Object.entries(news.events).find(
			([
				,
				{
					startAt: [, startAt],
					endAt: [, endAt],
				},
			]) =>
				startAt && endAt && dayjs().isAfter(startAt) && dayjs().isBefore(endAt),
		);
		if (!active) return;

		const uids = await collect(active[0]);
		const added = await redis().sadd(GBP.players, ...(uids as [string]));
		if (added > 0) await tags.add(`added_${added}`);
	},
});

const collect = async (id: string | number) => {
	const data = z
		.object({ users: z.array(z.object({ uid: z.coerce.string() })) })
		.parse(
			await fetch(
				`https://bestdori.com/api/eventtop/data?server=1&event=${id}&mid=0&interval=86400000`,
			).then((response) => response.json()),
		);

	return data.users.map(({ uid }) => uid);
};
