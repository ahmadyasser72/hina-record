import { cn } from "cn";
import { chunk, isEqual, kebabCase, startCase, sum, sumBy } from "es-toolkit";
import type { JSX } from "hono/jsx";

import {
	GbpBand,
	GbpCharacter,
	GbpCharacterBand,
	GbpStageChallenge,
	MusicClearKind,
	type MusicDifficulty,
	type ProfileSnapshot,
	type SnapshotChange,
} from "@hina-record/shared/db/schema";
import { Icon } from "~/lib/components/icon";

export const Display = {
	bandRank: (bandRank, previousValue) =>
		Object.entries(bandRank)
			.map(([id, value]) => {
				const previous = previousValue?.[Number(id) as GbpBand];
				return {
					id,
					value,
					previous,
					changed: previous !== undefined && value !== previous,
				};
			})
			.map(({ id, value, previous, changed }) => (
				<div class="stat w-max">
					<div class="stat-figure">
						<img
							alt={id}
							class="h-10"
							loading="lazy"
							src={`/assets/bands/${id}-logo.png`}
						/>
					</div>
					<div class="stat-value relative">
						{changed ? (
							<div class="swap">
								<div class="swap-off">{value}</div>
								<div class="swap-on">{previous}</div>
							</div>
						) : (
							(value ?? "-")
						)}

						<sub class="text-xs">/50</sub>
						{changed && (
							<ChangedDot class="absolute top-1/2 right-1 -translate-y-full" />
						)}
					</div>
				</div>
			)),
	characterRank: (characterRank, previousValue) =>
		chunk(Object.entries(characterRank), 5)
			.map((chunk, idx) => {
				const band = GbpCharacterBand[Number(chunk[0][0]) as GbpCharacter];
				const value = sumBy(chunk, ([, rank]) => rank);
				const previous = previousValue
					? sum(Object.values(previousValue).slice(idx * 5, idx * 5 + 5))
					: undefined;
				return {
					chunk,
					band: {
						id: band,
						value,
						previous,
						changed: previous !== undefined && value !== previous,
					},
				};
			})
			.map(({ chunk, band }) => (
				<>
					<div class="divider">
						<img
							alt={band.id.toString()}
							class="-mr-2 size-6"
							loading="lazy"
							src={`/assets/bands/${band.id}.svg`}
						/>

						<div>
							{GbpBand[band.id]} &mdash;{" "}
							{band.changed ? (
								<>
									<div class="swap">
										<div class="swap-off">
											{band.value?.toLocaleString()}/500
										</div>
										<div class="swap-on">
											{band.previous?.toLocaleString()}/500
										</div>
									</div>

									<ChangedDot />
								</>
							) : (
								`${band.value.toLocaleString()}/500`
							)}
						</div>
					</div>

					<div class="flex w-full flex-wrap justify-center">
						{chunk
							.map(([id, value]) => {
								const previous = previousValue?.[Number(id) as GbpCharacter];
								return {
									id,
									value,
									previous,
									changed: previous !== undefined && value !== previous,
								};
							})
							.map(({ id, value, previous, changed }) => (
								<div class="stat w-max">
									<div class="stat-figure">
										<img
											alt={id}
											class="size-10"
											loading="lazy"
											src={`/assets/characters/${id}.webp`}
										/>
									</div>
									<div class="stat-value">
										{changed ? (
											<>
												<div class="swap">
													<div class="swap-off">{value}</div>
													<div class="swap-on">{previous}</div>
												</div>

												<ChangedDot />
											</>
										) : (
											value
										)}
									</div>
									<div class="stat-desc">
										{GbpCharacter[Number(id) as GbpCharacter].split(" ")[0]}
									</div>
								</div>
							))}
					</div>
				</>
			)),
	musicClear: (musicClear, previousValue) => {
		const values = MusicClearKind.map((kind) => {
			const value = sumBy(
				Object.values(musicClear),
				(value) => value[kind] ?? 0,
			);
			const previous = previousValue
				? sumBy(Object.values(previousValue), (value) => value[kind] ?? 0)
				: undefined;
			return {
				kind,
				total: {
					value,
					previous,
					changed: previous !== undefined && value !== previous,
				},
			};
		});

		const overall = {
			value: sumBy(values, ({ total }) => total.value),
			previous: previousValue
				? sumBy(values, ({ total }) => total.previous ?? 0)
				: undefined,
		};

		return (
			<>
				{values.map(({ kind, total }) => (
					<>
						<div class="divider">
							<div>
								{startCase(kind)} &mdash;{" "}
								{total.changed ? (
									<>
										<div class="swap">
											<div class="swap-off">
												{total.value > 0
													? total.value.toLocaleString()
													: "Hidden"}
											</div>
											<div class="swap-on">
												{total.previous && total.previous > 0
													? total.previous.toLocaleString()
													: "Hidden"}
											</div>
										</div>

										<ChangedDot />
									</>
								) : total.value > 0 ? (
									total.value.toLocaleString()
								) : (
									"Hidden"
								)}
							</div>
						</div>
						<div class="flex w-full flex-wrap justify-center">
							{Object.entries(musicClear)
								.map(([difficulty, values]) => {
									const value = values[kind];
									const previous =
										previousValue?.[difficulty as MusicDifficulty][kind];
									return {
										difficulty,
										value,
										previous,
										changed: previous !== undefined && value !== previous,
									};
								})
								.map(({ difficulty, value, previous, changed }) => (
									<div class="stat w-max flex-1 place-items-center">
										<div
											class="stat-title badge bg-music-difficulty text-white uppercase"
											data-difficulty={difficulty}
										>
											{difficulty}
										</div>
										<div class="stat-value">
											{changed ? (
												<>
													<div class="swap">
														<div class="swap-off">{value ?? "-"}</div>
														<div class="swap-on">{previous ?? "-"}</div>
													</div>

													<ChangedDot />
												</>
											) : (
												(value ?? "-")
											)}
										</div>
									</div>
								))}
						</div>
					</>
				))}

				<div class="divider">
					<div>
						Overall{" "}
						{overall.previous !== undefined ? (
							<>
								<div class="swap">
									<div class="swap-off">
										{overall.value > 0
											? overall.value.toLocaleString()
											: "Hidden"}
									</div>
									<div class="swap-on">
										{overall.previous > 0
											? overall.previous.toLocaleString()
											: "Hidden"}
									</div>
								</div>

								<ChangedDot />
							</>
						) : overall.value > 0 ? (
							overall.value.toLocaleString()
						) : (
							"Hidden"
						)}
					</div>
				</div>
			</>
		);
	},
	highScoreRating: (highScoreRating, previousValue) => (
		<>
			{[...Object.keys(GbpBand).slice(0, 8), 0]
				.map((it) => {
					const id = it as GbpBand | 0;
					const value = sumBy(highScoreRating[id], ({ rating }) => rating);
					const previous = previousValue
						? sumBy(previousValue[id], ({ rating }) => rating)
						: undefined;
					return {
						band: {
							id,
							value,
							previous,
							changed: previous !== undefined && value !== previous,
						},
					};
				})
				.map(({ band }) => (
					<>
						<div class="divider">
							{band.id !== 0 && (
								<img
									alt={band.id.toString()}
									class="-mr-2 size-6"
									loading="lazy"
									src={`/assets/bands/${band.id}.svg`}
								/>
							)}

							<div>
								{band.id === 0 ? "Other" : GbpBand[band.id]} &mdash;{" "}
								{band.changed ? (
									<>
										<div class="swap">
											<div class="swap-off">{band.value.toLocaleString()}</div>
											<div class="swap-on">
												{band.previous?.toLocaleString()}
											</div>
										</div>

										<ChangedDot />
									</>
								) : (
									band.value.toLocaleString()
								)}
							</div>
						</div>
						<div class="flex w-full flex-wrap justify-center">
							{highScoreRating[band.id]
								.map((value, idx) => {
									const previous = previousValue
										? previousValue[band.id][idx]
										: undefined;
									return {
										value,
										previous,
										changed:
											previous !== undefined && !isEqual(value, previous),
									};
								})
								.map(
									({
										value: { music, difficulty, rating },
										previous,
										changed,
									}) =>
										changed ? (
											<div class="swap">
												<div class="stat swap-off w-max md:flex-1">
													<div
														class="tooltip tooltip-end stat-figure"
														data-tip={music.title}
													>
														<img
															alt={music.jacketImage}
															class="size-24"
															loading="lazy"
															src={`/assets/music/${music.id}/${music.jacketImage}.png`}
														/>
													</div>
													<div
														class="stat-title badge bg-music-difficulty text-white uppercase"
														data-difficulty={difficulty}
													>
														{difficulty}
													</div>
													<div class="stat-value">{rating}</div>
												</div>
												<div class="stat swap-on w-max md:flex-1">
													<div
														class="tooltip tooltip-end stat-figure"
														data-tip={previous?.music.title}
													>
														<img
															alt={previous?.music.jacketImage}
															class="size-24"
															loading="lazy"
															src={`/assets/music/${previous?.music.id}/${previous?.music.jacketImage}.png`}
														/>
													</div>
													<div
														class="stat-title badge bg-music-difficulty text-white uppercase"
														data-difficulty={previous?.difficulty}
													>
														{previous?.difficulty}
													</div>
													<div class="stat-value">{previous?.rating}</div>
												</div>
											</div>
										) : (
											<div class="stat w-max md:flex-1">
												<div
													class="tooltip tooltip-end stat-figure"
													data-tip={music.title}
												>
													<img
														alt={music.jacketImage}
														class="size-24"
														loading="lazy"
														src={`/assets/music/${music.id}/${music.jacketImage}.png`}
													/>
												</div>
												<div
													class="stat-title badge bg-music-difficulty text-white uppercase"
													data-difficulty={difficulty}
												>
													{difficulty}
												</div>
												<div class="stat-value">{rating}</div>
											</div>
										),
								)}
						</div>
					</>
				))}

			<div class="divider">
				Overall{" "}
				{sumBy(Object.values(highScoreRating), (songs) =>
					sumBy(songs, ({ rating }) => rating),
				).toLocaleString()}
			</div>
		</>
	),
	deckRating: (deckRating, previousValue) => {
		const overall = {
			value: sumBy(Object.values(deckRating), ({ score }) => score),
			previous: previousValue
				? sumBy(Object.values(previousValue), ({ score }) => score)
				: undefined,
		};

		return (
			<>
				{Object.entries(deckRating)
					.map(([id, value]) => {
						const previous = previousValue?.[Number(id) as GbpBand];
						return {
							id,
							value,
							previous,
							changed: previous !== undefined && !isEqual(value, previous),
						};
					})
					.map(({ id, value, previous, changed }) => (
						<div class="stat w-max flex-1">
							<div class="stat-figure flex flex-col items-center">
								<img
									alt={id}
									class="h-10"
									loading="lazy"
									src={`/assets/bands/${id}.svg`}
								/>

								{changed && <ChangedDot class="mt-2" />}
							</div>

							{changed ? (
								<div class="swap">
									<div class="swap-off">
										<div class="stat-value uppercase">
											{value.rank}
											{value.rank !== "-" && <sub>{value.level}</sub>}
										</div>
										<div class="stat-desc">{value.score.toLocaleString()}</div>
									</div>
									<div class="swap-on">
										<div class="stat-value uppercase">
											{previous?.rank ?? "-"}
											{previous?.rank && <sub>{previous.level}</sub>}
										</div>
										<div class="stat-desc">
											{previous?.score.toLocaleString() ?? "-"}
										</div>
									</div>
								</div>
							) : (
								<>
									<div class="stat-value uppercase">
										{value.rank}
										{value.rank !== "-" && <sub>{value.level}</sub>}
									</div>
									<div class="stat-desc">{value.score.toLocaleString()}</div>
								</>
							)}
						</div>
					))}

				<div class="divider">
					<div>
						Overall{" "}
						{overall.previous !== undefined ? (
							<>
								<div class="swap">
									<div class="swap-off">{overall.value.toLocaleString()}</div>
									<div class="swap-on">{overall.previous.toLocaleString()}</div>
								</div>

								<ChangedDot />
							</>
						) : (
							overall.value.toLocaleString()
						)}
					</div>
				</div>
			</>
		);
	},
	stageChallenge: (stageChallenge, previousValue) =>
		Object.entries(GbpStageChallenge)
			.map(([id, logo]) => {
				const value = stageChallenge[Number(id)];
				const previous = previousValue?.[Number(id)];
				return {
					logo,
					value,
					previous: previous ?? 0,
					changed: previous !== undefined && value !== previous,
				};
			})
			.map(({ logo, value, previous, changed }) => (
				<div class="stat w-max">
					<div class="stat-figure">
						<img
							alt={logo.toString()}
							class="h-10"
							loading="lazy"
							src={
								logo in GbpBand
									? `/assets/bands/${logo}-logo.png`
									: `/assets/stage-challenges/${logo}.png`
							}
						/>
					</div>
					<div class="stat-value relative">
						{changed ? (
							<div class="swap">
								<div class="swap-off">{value}</div>
								<div class="swap-on">{previous}</div>
							</div>
						) : (
							(value ?? "-")
						)}

						<sub class="text-xs">/{logo in GbpBand ? 90 : 45}</sub>
						{changed && (
							<ChangedDot class="absolute top-1/2 right-1 -translate-y-full" />
						)}
					</div>
				</div>
			)),
} satisfies {
	[C in Exclude<
		SnapshotChange,
		"uid" | "username" | "rank" | "introduction" | "profileCard"
	>]: CollapseWrapperProps<C>["children"];
};

type SnapshotData = Pick<ProfileSnapshot, SnapshotChange | "uid">;
interface CollapseWrapperProps<C extends SnapshotChange> {
	data: SnapshotData & {
		previous: SnapshotData | null;
	};
	dataKey: C;
	changes: Set<SnapshotChange>;
	children: (
		value: NonNullable<SnapshotData[C]>,
		previous?: SnapshotData[C],
	) => unknown;
}

export const CollapseWrapper = <C extends SnapshotChange>({
	data,
	dataKey,
	changes,
	children,
}: CollapseWrapperProps<C>) => {
	const value = data[dataKey];
	const changed = changes.has(dataKey);
	const id = `collapse-${kebabCase(dataKey)}`;

	return (
		<details
			class={cn(
				"border-base-content/10 collapse border",
				value ? "collapse-arrow" : "pointer-events-none",
			)}
			id={id}
		>
			<summary class="collapse-title font-medium">
				{startCase(dataKey)}
				{changed && (
					<div class="badge badge-primary badge-xs ml-2 align-middle">
						Changed
					</div>
				)}
				{!value && (
					<div class="badge badge-neutral badge-xs ml-2 align-middle">
						Hidden
					</div>
				)}
			</summary>
			{value && (
				<div class="collapse-content relative">
					{children(value, changed ? data.previous?.[dataKey] : undefined)}

					{changed && (
						<button
							class="btn btn-sm btn-soft btn-accent sticky bottom-4 w-full"
							hx-on:click={[
								`let changed = q(".swap in #${id}");`,
								`if (!changed.arr().some(__elementIsInViewport))`,
								`  q("first .swap in #${id}").scrollIntoView({ behavior: "smooth", block: "center" });`,
								`changed.toggle(".swap-active");`,
								`q(".changed-dot in #${id}").toggle(".status-primary").toggle(".status-secondary");`,
							].join("\n")}
							type="button"
						>
							<Icon name="pixelarticons--switch" />
							Swap Changed
						</button>
					)}
				</div>
			)}
		</details>
	);
};

export const ChangedDot = ({
	from,
	class: className,
	...props
}: JSX.HTMLAttributes & { from?: string | number }) => (
	<span
		class={cn(
			"changed-dot",
			"status status-primary ml-1 align-middle",
			from && "tooltip tooltip-primary tooltip-end",
			className,
		)}
		data-tip={from ? `Changed from: ${from}` : undefined}
		{...props}
	></span>
);
