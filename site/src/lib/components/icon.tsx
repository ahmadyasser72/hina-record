import { cn } from "cn";
import type { JSX } from "hono/jsx";

export type IconSet = "pixelarticons" | "svg-spinners";
export interface IconProps {
	name: `${IconSet}--${string}`;
	size?: `size-${number}`;
}

export const Icon = ({
	name,
	size = "size-4",
	class: className,
	...props
}: IconProps & JSX.HTMLAttributes) => (
	<div class={cn("iconify", name, size, className)} {...props}></div>
);
