import { cn } from "cn";
import { isEqual, kebabCase, startCase, sum, sumBy, zip } from "es-toolkit";
import type { JSX } from "hono/jsx";

import {
	GbpBand,
	GbpCharacter,
	GbpCharactersByBand,
	GbpStageChallenge,
	MusicClearKind,
	MusicDifficulty,
	type ProfileSnapshot,
	type SnapshotChange,
} from "@hina-record/shared/db/schema";
import { Icon } from "~/lib/components/icon";

export const Display = {
	bandRank: (bandRank, previousValue) => (
		<div class="stats-vertical flex flex-wrap justify-center">
			{Object.keys(bandRank)
				.map(
					withPrevious({
						getValue: (data, key: GbpBand) => data[key],
						value: bandRank,
						previous: previousValue,
					}),
				)
				.map(({ id, ...data }) => (
					<div class="stat w-max">
						<div class="stat-figure">
							<img
								alt={id.toString()}
								class="h-10"
								loading="lazy"
								src={`/assets/bands/${id}-logo.png`}
							/>
						</div>
						<div class="stat-value">
							<DisplayWithPrevious {...data}>
								{(value) => (
									<>
										{value}
										<sub>/50</sub>
									</>
								)}
							</DisplayWithPrevious>
						</div>
					</div>
				))}
		</div>
	),
	characterRank: (characterRank, previousValue) => {
		const values = Object.keys(GbpCharactersByBand).map(
			withPrevious({
				getValue: (data, key: GbpBand) => {
					const characters = GbpCharactersByBand[key];
					return {
						characters: characters.map((id) => ({ id, value: data[id] })),
						total: sumBy(characters, (id) => data[id]),
					};
				},
				value: characterRank,
				previous: previousValue,
			}),
		);
		const overall = withPrevious({
			getValue: (data) => sum(Object.values(data)),
			value: characterRank,
			previous: previousValue,
		})();

		return (
			<>
				{values.map((band) => (
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
								<DisplayWithPrevious {...band}>
									{({ total }) => `${total.toLocaleString()}/500`}
								</DisplayWithPrevious>
							</div>
						</div>

						<div class="max-md:stats-vertical flex w-full flex-wrap justify-center">
							{zip(band.value.characters, band.previous?.characters ?? []).map(
								([value, previous]) => (
									<div class="stat w-max">
										<div class="stat-figure">
											<img
												alt={value.id.toString()}
												class="size-10"
												loading="lazy"
												src={`/assets/characters/${value.id}.webp`}
											/>
										</div>
										<div class="stat-value">
											<DisplayWithPrevious
												changed="auto"
												previous={previous}
												value={value}
											>
												{({ value }) => value}
											</DisplayWithPrevious>
										</div>
										<div class="stat-desc">
											{GbpCharacter[value.id].split(" ")[0]}
										</div>
									</div>
								),
							)}
						</div>
					</>
				))}

				<div class="divider">
					Overall{" "}
					<DisplayWithPrevious {...overall}>
						{(value) => `${value.toLocaleString()}/${values.length * 500}`}
					</DisplayWithPrevious>
				</div>
			</>
		);
	},
	musicClear: (musicClear, previousValue) => {
		const values = MusicClearKind.map(
			withPrevious({
				getValue: (data, key: MusicClearKind) =>
					sum(Object.values(data).map((value) => value[key] ?? 0)),
				value: musicClear,
				previous: previousValue,
			}),
		);
		const overall = withPrevious({
			getValue: (data) =>
				sumBy(Object.values(data), (values) =>
					sum(Object.values(values).filter((value) => value !== null)),
				),
			value: musicClear,
			previous: previousValue,
		})();

		return (
			<>
				{values.map(({ id, ...total }) => (
					<>
						<div class="divider">
							<div>
								{startCase(id)} &mdash;{" "}
								<DisplayWithPrevious {...total}>
									{(value) => (value > 0 ? value.toLocaleString() : "Hidden")}
								</DisplayWithPrevious>
							</div>
						</div>
						<div class="max-md:stats-vertical flex w-full flex-wrap justify-center">
							{MusicDifficulty.map(
								withPrevious({
									getValue: (data, key: MusicDifficulty) => data[key][id],
									value: musicClear,
									previous: previousValue,
								}),
							).map(({ id, ...data }) => (
								<div class="stat w-max flex-1 place-items-center">
									<div
										class="stat-title badge bg-music-difficulty text-white uppercase"
										data-difficulty={id}
									>
										{id}
									</div>
									<div class="stat-value">
										<DisplayWithPrevious {...data}>
											{(value) => value ?? "-"}
										</DisplayWithPrevious>
									</div>
								</div>
							))}
						</div>
					</>
				))}

				<div class="divider">
					<div>
						Overall{" "}
						<DisplayWithPrevious {...overall}>
							{(value) => value.toLocaleString()}
						</DisplayWithPrevious>
					</div>
				</div>
			</>
		);
	},
	highScoreRating: (highScoreRating, previousValue) => {
		const overall = withPrevious({
			getValue: (data) =>
				sumBy(Object.values(data).flat(), ({ rating }) => rating),
			value: highScoreRating,
			previous: previousValue,
		})();

		return (
			<>
				{[...Object.keys(GbpBand).slice(0, 8), 0]
					.map(
						withPrevious({
							getValue: (data, key: GbpBand | 0) => ({
								rating: sumBy(data[key], ({ rating }) => rating),
								values: data[key],
							}),
							value: highScoreRating,
							previous: previousValue,
						}),
					)
					.map((band) => (
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
									<DisplayWithPrevious {...band}>
										{({ rating }) => rating.toLocaleString()}
									</DisplayWithPrevious>
								</div>
							</div>
							<div class="flex sm:justify-evenly">
								{zip(band.value.values, band.previous?.values ?? []).map(
									([value, previous], idx) => (
										<DisplayWithPrevious
											changed={{ value: band.changed, display: false }}
											previous={previous}
											value={value}
										>
											{({ music, difficulty, rating }) => (
												<div
													class={cn(
														"tooltip tooltip-primary tooltip-bottom card image-full max-sm:flex-1 sm:aspect-square sm:max-h-48",
														idx === 0 && "tooltip-start",
														idx === 2 && "tooltip-end",
													)}
													data-tip={music.title}
												>
													<figure>
														<img
															alt={music.jacketImage}
															loading="lazy"
															src={`/assets/music/${music.id}/${music.jacketImage}.png`}
														/>
													</figure>
													<div class="card-body items-center justify-end gap-0.5 p-1 text-center">
														<div
															class="badge badge-xs bg-music-difficulty text-white uppercase"
															data-difficulty={difficulty}
														>
															{difficulty}
														</div>
														<div class="text-lg">{rating}</div>
													</div>
												</div>
											)}
										</DisplayWithPrevious>
									),
								)}
							</div>
						</>
					))}

				<div class="divider">
					Overall{" "}
					<DisplayWithPrevious {...overall}>
						{(value) => value.toLocaleString()}
					</DisplayWithPrevious>
				</div>
			</>
		);
	},
	deckRating: (deckRating, previousValue) => {
		const overall = withPrevious({
			getValue: (data) => sumBy(Object.values(data), ({ score }) => score),
			value: deckRating,
			previous: previousValue,
		})();

		return (
			<>
				<div class="stats-vertical flex flex-wrap justify-center">
					{Object.keys(deckRating)
						.map(
							withPrevious({
								getValue: (data, key: GbpBand) => data[key],
								value: deckRating,
								previous: previousValue,
							}),
						)
						.map(({ id, changed, ...data }) => (
							<div class="stat w-max">
								<div class="stat-figure flex flex-col items-center">
									<img
										alt={id.toString()}
										class="h-10"
										loading="lazy"
										src={`/assets/bands/${id}.svg`}
									/>

									{changed && <ChangedDot class="mt-2" />}
								</div>

								<DisplayWithPrevious
									changed={{ value: changed, display: false }}
									{...data}
								>
									{(value) => (
										<>
											<div class="stat-value uppercase">
												{value.rank}
												{value.rank !== "-" && <sub>{value.level}</sub>}
											</div>
											<div class="stat-desc">
												{value.score.toLocaleString()}
											</div>
										</>
									)}
								</DisplayWithPrevious>
							</div>
						))}
				</div>

				<div class="divider">
					<div>
						Overall{" "}
						<DisplayWithPrevious {...overall}>
							{(value) => value.toLocaleString()}
						</DisplayWithPrevious>
					</div>
				</div>
			</>
		);
	},
	stageChallenge: (stageChallenge, previousValue) => (
		<div class="stats-vertical flex flex-wrap justify-center">
			{Object.keys(GbpStageChallenge)
				.map(
					withPrevious({
						getValue: (data, key: keyof typeof GbpStageChallenge) => data[key],
						value: stageChallenge,
						previous: previousValue,
					}),
				)
				.map((data) => ({ ...data, logo: GbpStageChallenge[data.id] }))
				.map(({ logo, ...data }) => (
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
						<div class="stat-value">
							<DisplayWithPrevious {...data}>
								{(value) => (
									<>
										{value}
										<sub>/{logo in GbpBand ? 90 : 45}</sub>
									</>
								)}
							</DisplayWithPrevious>
						</div>
					</div>
				))}
		</div>
	),
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
								`let changed = q("[data-swap] in #${id}");`,
								`if (!changed.arr().some(__elementIsInViewport))`,
								`  q("first [data-swap] in #${id}").parentElement.scrollIntoView({ behavior: "smooth", block: "center" });`,
								`for (let e of changed) {`,
								`  let [swap, old] = [e.dataset.swap, e.innerHTML];`,
								`  e.dataset.swap = old;`,
								`  htmx.swap({ target: e, text: swap, swap: "innerMorph" });`,
								`}`,
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

interface WithPreviousOptions<K, T, O> {
	getValue: (data: T, key: K) => O;
	value: T;
	previous?: T | null;
}

export const withPrevious = <K, T, O>({
	getValue,
	...data
}: WithPreviousOptions<K, T, O>) => {
	return (key?: unknown) => {
		const id = key as K;
		const value = getValue(data.value, id);
		const previous = data.previous ? getValue(data.previous, id) : undefined;
		return {
			id,
			value,
			previous,
			changed: previous !== undefined && !isEqual(value, previous),
		};
	};
};

interface DisplayWithPreviousProps<T, O> {
	value: T;
	previous?: T;
	changed: "auto" | boolean | { value: boolean; display: boolean };
	children?: (value: T) => O;
}

export const DisplayWithPrevious = <T, O>({
	value,
	previous,
	changed,
	children,
}: DisplayWithPreviousProps<T, O>) => {
	const hasChanged =
		changed === true ||
		(typeof changed === "object" && changed.value) ||
		(changed === "auto" && previous !== undefined && !isEqual(value, previous));
	return (
		<>
			<div
				class="contents"
				data-swap={
					hasChanged && previous
						? (children?.(previous) ?? previous).toString()
						: undefined
				}
			>
				{children?.(value) ?? value}
			</div>

			{(hasChanged || (typeof changed === "object" && changed.display)) && (
				<ChangedDot />
			)}
		</>
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
