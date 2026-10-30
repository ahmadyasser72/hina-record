import { cn } from "cn";
import { chunk, startCase } from "es-toolkit";
import { cache } from "hono/cache";
import { basePath } from "hono/route";

import { formatDate } from "@hina-record/shared/date";
import { db, GBP, redis } from "@hina-record/shared/db";
import { factory } from "~/factory";
import { Icon } from "~/lib/components/icon";
import { stripFormat } from "~/lib/format";
import { ChangedDot, CollapseWrapper, Display } from "./peek.display";

const app = factory.createApp();
if (import.meta.env.PROD)
	app.use(cache({ cacheName: "routes.peek", cacheControl: "max-age=3600" }));

export const peekApp = app
	.get("/list", async (c) => {
		const getProfile = ([uid, lastUpdated]: number[]) =>
			db().query.profileSnapshots.findFirst({
				columns: {
					uid: true,
					timestamp: true,
					username: true,
					profileCard: true,
					introduction: true,
				},
				where: {
					timestamp: { lte: new Date(lastUpdated) },
					uid: uid.toString(),
					changes: true,
				},
				orderBy: { timestamp: "desc" },
				with: {
					changes: {
						columns: { value: true },
						orderBy: { value: "asc" },
					},
				},
			});

		const latest = await redis()
			.zrange<number[]>(GBP.players, 0, import.meta.env.DEV ? 10 : -1, {
				withScores: true,
				rev: true,
			})
			.then((results) =>
				db()
					.batch(
						chunk(results, 2).map(getProfile) as [
							ReturnType<typeof getProfile>,
						],
					)
					.then((profiles) => profiles.filter((it) => it !== undefined)),
			);

		return c.render(
			<>
				<div class="flex-1">
					<div
						class="list grid sm:grid-cols-2 lg:grid-cols-3"
						hx-boost:inherited="true"
						hx-on:load={[
							`let rows = q(".list-row in this").arr();`,
							`rows.sort((a, b) => Number(b.dataset.timestamp) - Number(a.dataset.timestamp) || a.dataset.keywords.localeCompare(b.dataset.keywords));`,
							`for (let row of rows) this.appendChild(row);`,
						].join("\n")}
					>
						{latest.map(
							({
								uid,
								timestamp,
								username,
								profileCard,
								introduction,
								changes,
							}) => (
								<a
									class="list-row hover:bg-base-content/10"
									data-keywords={[
										username,
										introduction,
										...changes.map(({ value }) => value),
									]
										.map((s) => stripFormat(s).toLowerCase())
										.join("\t")}
									data-timestamp={timestamp.getTime()}
									data-uid={uid}
									href={[basePath(c), uid].join("/")}
								>
									{profileCard && (
										<div>
											<img
												alt={profileCard.resourceSetName}
												class="rounded-box size-10"
												loading="lazy"
												src={`/assets/card-icon/${profileCard.situationId}/${profileCard.resourceSetName}/${profileCard.illust}.png`}
											/>
										</div>
									)}

									<div class="flex flex-col gap-1">
										<div>{stripFormat(username)}</div>
										<div class="text-xs">{stripFormat(introduction)}</div>
										<div class="flex flex-wrap gap-0.5">
											<div class="badge badge-primary badge-soft badge-xs">
												{formatDate(timestamp)}
											</div>
											{changes.map(({ value }) => (
												<div class="badge badge-xs badge-secondary">
													{startCase(value)}
												</div>
											))}
										</div>
									</div>

									<Icon
										class="loader my-auto"
										name="svg-spinners--90-ring-with-bg"
										size="size-5"
									/>
								</a>
							),
						)}
					</div>
				</div>

				<input
					class="input input-secondary sticky bottom-4 left-1/2 mt-4 w-1/3 -translate-x-1/2 sm:bottom-6"
					hx-live={[
						`let term = this.value.trim().toLowerCase();`,
						`for (let e of q("previous .list").q(".list-row"))`,
						`  e.classList.toggle("hidden", term && !e.dataset.keywords.includes(term) && e.dataset.uid !== term)`,
					].join("\n")}
					hx-on:load="this.focus()"
					placeholder="Search"
					type="text"
				/>
			</>,
		);
	})
	.get("/:uid{[0-9]+}/:timestamp{[0-9]+}?", async (c) => {
		const uid = c.req.param("uid");
		const timestamp = c.req.param("timestamp");

		const changesConfig = { columns: { value: true } } as const;
		const profileColumns = { hash: false, id: false, proto: false } as const;
		const data = await db().query.profileSnapshots.findFirst({
			columns: profileColumns,
			where: {
				...(timestamp && { timestamp: { eq: new Date(Number(timestamp)) } }),
				uid,
			},
			orderBy: { timestamp: "desc" },
			with: {
				changes: changesConfig,
				previous: { columns: profileColumns, with: { changes: changesConfig } },
				next: { columns: profileColumns, with: { changes: changesConfig } },
			},
		});
		if (!data) return c.notFound();

		const changes = new Set(data.changes.map(({ value }) => value));
		return c.render(
			<>
				{data.profileCard && (
					<img
						alt={`${data.profileCard.resourceSetName}_${data.profileCard.illust}`}
						class="mx-auto aspect-video h-80 w-4/5 object-cover"
						src={`/assets/card-splash/${data.profileCard.resourceSetName}/${data.profileCard.illust}.png`}
					/>
				)}
				<section class="mt-6 flex flex-col items-center">
					<div class="flex gap-1">
						<span
							class="badge badge-primary badge-soft tooltip tooltip-primary tooltip-left"
							data-tip="UID"
						>
							<Icon name="pixelarticons--hash" />
							{data.uid}
						</span>
						<span
							class="badge badge-accent badge-soft tooltip tooltip-accent tooltip-right"
							data-tip="Rank/Level"
						>
							<Icon name="pixelarticons--crown" />
							{data.rank}
							{changes.has("rank") && <ChangedDot from={data.previous?.rank} />}
						</span>
					</div>
					<h1 class="mt-1 text-center text-2xl font-medium">
						{data.username}
						{changes.has("username") && (
							<ChangedDot from={data.previous?.username} />
						)}
					</h1>
					<span class="mt-2 text-sm">
						{data.introduction}
						{changes.has("introduction") && (
							<ChangedDot from={data.previous?.introduction} />
						)}
					</span>
				</section>

				<div
					class="divider"
					hx-boost:inherited="swap:outerMorph show:none transition:true"
				>
					<a
						class={cn(
							"btn btn-sm btn-accent btn-soft btn-circle",
							data.previous
								? "tooltip tooltip-accent tooltip-start before:text-start before:whitespace-pre"
								: "btn-disabled",
						)}
						data-tip={
							data.previous
								? [
										...data.previous.changes
											.map(({ value }) => value)
											.map(startCase),
										formatDate(data.previous.timestamp),
									].join("\n")
								: undefined
						}
						href={
							data.previous
								? [basePath(c), uid, data.previous.timestamp.getTime()].join(
										"/",
									)
								: undefined
						}
					>
						<Icon name="pixelarticons--chevron-left" />
					</a>

					{formatDate(data.timestamp)}

					<a
						class={cn(
							"btn btn-sm btn-accent btn-soft btn-circle",
							data.next
								? "tooltip tooltip-accent tooltip-end before:text-end before:whitespace-pre"
								: "btn-disabled",
						)}
						data-tip={
							data.next
								? [
										...data.next.changes
											.map(({ value }) => value)
											.map(startCase),
										formatDate(data.next.timestamp),
									].join("\n")
								: undefined
						}
						href={
							data.next
								? [basePath(c), uid, data.next.timestamp.getTime()].join("/")
								: undefined
						}
					>
						<Icon name="pixelarticons--chevron-right" />
					</a>
				</div>

				<section class="mt-8 flex w-full flex-col gap-2">
					{Object.keys(Display)
						.map((change) => change as keyof typeof Display)
						.map((change) => (
							<CollapseWrapper changes={changes} data={data} dataKey={change}>
								{Display[change] as never}
							</CollapseWrapper>
						))}
				</section>
			</>,
		);
	});
