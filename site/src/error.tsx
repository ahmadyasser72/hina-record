import { factory } from "./factory";
import { Icon } from "./lib/components/icon";

export const notFound = factory.defineHandler((c) =>
	c.render(
		<div class="flex flex-1 items-center justify-center">
			<div class="text-error flex flex-col items-center gap-2 text-xl">
				<Icon name="pixelarticons--warning-diamond" size="size-16" />
				Page not found!
			</div>
		</div>,
	),
);

export const onError = factory.defineHandler((c) => {
	console.error(c.error);
	return c.render(
		<div class="flex flex-1 items-center justify-center">
			<div class="text-error flex flex-col items-center gap-2 text-xl">
				<Icon name="pixelarticons--warning-diamond" size="size-16" />
				{c.error ? `${c.error.name}: ${c.error.message}` : "Unknown Error"}
			</div>
		</div>,
	);
});
