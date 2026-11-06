import { cn } from "cn";
import { chunk, startCase } from "es-toolkit";
import { cache } from "hono/cache";
import { raw } from "hono/html";
import { basePath } from "hono/route";
import MiniSearch from "minisearch";

import { formatDate } from "@hina-record/shared/date";
import { db, GBP, redis } from "@hina-record/shared/db";
import { factory } from "~/factory";
import { Icon } from "~/lib/components/icon";
import { stripFormat } from "~/lib/format";
import { filterTerms, highlight } from "~/lib/highlight";
import { ChangedDot, CollapseWrapper, Display } from "./peek.display";

const app = factory.createApp();
if (import.meta.env.PROD)
	app.use(cache({ cacheName: "routes.peek", cacheControl: "max-age=3600" }));

export const peekApp = app
	.get("/list/:page{[1-9]+}?", async (c) => {
		const getProfile = ([uid, id]: number[]) =>
			db().query.profileSnapshots.findFirst({
				columns: {
					uid: true,
					timestamp: true,
					username: true,
					profileCard: true,
					introduction: true,
				},
				where: { id: { lte: id }, uid: uid.toString(), changes: true },
				orderBy: { timestamp: "desc" },
				with: {
					changes: {
						columns: { value: true },
						orderBy: { value: "asc" },
					},
				},
			});

		const players = await redis()
			.zrange<number[]>(GBP.players, 0, import.meta.env.DEV ? 40 : -1, {
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

		const query = c.req.query("q")?.trim().toLowerCase();
		const { results, suggestions = [] } = (() => {
			type Player = (typeof players)[number];
			type PlayerDefault = Player & { score: undefined; highlight: undefined };

			if (!query) return { results: players as PlayerDefault[] };

			const lookup = new Map(players.map((player) => [player.uid, player]));
			if (lookup.has(query))
				return { results: [lookup.get(query) as PlayerDefault] };

			const fields = ["username", "introduction"] as const;
			const index = new MiniSearch<Player>({
				idField: "uid",
				fields: [...fields],
				processTerm: (term) => stripFormat(term).toLowerCase(),
				searchOptions: {
					combineWith: "OR",
					fuzzy: true,
					prefix: true,
					boost: { username: 1.5 },
				},
			});
			index.addAll(players);

			return {
				results: index.search(query).map(({ id, match, score }) => {
					const data = lookup.get(id) as Player;
					return {
						...data,
						score,
						highlight: (key: (typeof fields)[number]) => {
							const terms = filterTerms(match, key);
							return highlight(stripFormat(data[key]), terms);
						},
					};
				}),
				suggestions: index
					.autoSuggest(query)
					.map(({ suggestion }) => suggestion)
					.filter((value) => value.length > 2)
					.slice(0, 10),
			};
		})();

		results.sort(
			(a, b) =>
				(b.score ?? 0) - (a.score ?? 0) ||
				stripFormat(a.username).localeCompare(stripFormat(b.username)),
		);

		const PAGE_SIZE = 20;
		const page = Number(c.req.param("page") ?? 1);
		const offset = (page - 1) * PAGE_SIZE;
		const items = results.slice(offset, offset + PAGE_SIZE);
		const nextPage =
			results.length > offset + PAGE_SIZE
				? [basePath(c), "list", page + 1].join("/")
				: undefined;

		return c.render(
			<>
				<div class="flex-1">
					<div
						class="list grid sm:grid-cols-2 lg:grid-cols-3"
						id="peek-list"
						hx-boost:inherited="true"
					>
						{items.map(
							({
								uid,
								timestamp,
								username,
								profileCard,
								introduction,
								changes,
								highlight,
							}) => (
								<a
									class="list-row hover:bg-base-content/10 htmx:bg-base-content/10"
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
										<div>
											{highlight
												? raw(highlight("username"))
												: stripFormat(username)}
										</div>
										<div class="text-xs">
											{highlight
												? raw(highlight("introduction"))
												: stripFormat(introduction)}
										</div>
										<div class="flex flex-wrap gap-0.5">
											<div class="badge badge-primary badge-soft badge-xs">
												{formatDate(timestamp)}
											</div>
											{changes.map(({ value }) => (
												<div class="badge badge-secondary badge-xs">
													{startCase(value)}
												</div>
											))}
										</div>
									</div>

									<div class="iconify loader my-auto" size="size-8" />
								</a>
							),
						)}
					</div>

					{nextPage ? (
						<div
							class="col-span-full mt-4 flex"
							hx-swap-oob="true"
							id="load-more-players"
						>
							<button
								class="btn btn-accent btn-outline mx-auto w-full sm:w-1/3"
								hx-get={query ? `${nextPage}?q=${query}` : nextPage}
								hx-select=".list-row"
								hx-swap="append"
								hx-target="#peek-list"
								type="button"
							>
								<Icon name="pixelarticons--list" />
								Load more
							</button>
						</div>
					) : (
						<div hx-swap-oob="true" id="load-more-players"></div>
					)}
				</div>

				<div class="sticky bottom-4 mt-4 flex w-full sm:bottom-6">
					<label class="input input-secondary mx-auto w-full sm:w-1/3">
						<Icon name="pixelarticons--search" />
						<input
							hx-get={c.req.path}
							hx-indicator="closest .input"
							hx-select="#peek-list"
							hx-select-oob="#players-suggestions"
							hx-swap="outerSync"
							hx-target="#peek-list"
							hx-trigger="input delay:300ms, keyup[key=='Enter']"
							list="players-suggestions"
							name="q"
							placeholder="Search..."
							type="text"
						/>

						<datalist id="players-suggestions">
							{suggestions.map((value) => (
								<option value={value}></option>
							))}
						</datalist>
					</label>
				</div>
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
