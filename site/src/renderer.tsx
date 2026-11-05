import comicReliefWoff2 from "@fontsource/comic-relief/files/comic-relief-latin-400-normal.woff2?url";
import { jsxRenderer, useRequestContext } from "hono/jsx-renderer";
import { Link, Script, ViteClient } from "vite-ssr-components/hono";

import { factory } from "./factory";
import { Icon, type IconProps } from "./lib/components/icon";

const fonts = [comicReliefWoff2];

export const renderer = factory.defineMiddleware(
	jsxRenderer(({ children }) => {
		return (
			<html lang="en">
				<head>
					<meta charset="utf-8" />
					<meta
						content="width=device-width, initial-scale=1.0"
						name="viewport"
					/>
					<ViteClient />

					<Link href="/src/styles/global.css" rel="stylesheet" />
					{fonts.map((href) => (
						<link
							as="font"
							crossorigin="anonymous"
							href={href}
							rel="preload"
							type="font/woff2"
						/>
					))}
					<Script src="/src/client.ts" />

					<meta
						content="extensions:'browser-indicator,hx-live' boostBrowserIndicator:true"
						name="htmx-config"
					/>
				</head>
				<body>
					<main class="container mx-auto flex min-h-screen max-w-4xl flex-col p-4 lg:max-w-5xl">
						<div class="mb-4 flex justify-between">
							<MegaMenu />

							<ThemeSwitcher />
						</div>

						<div class="contents" id="content">
							{children}
						</div>
					</main>
				</body>
			</html>
		);
	}),
);

const MegaMenu = () => {
	const c = useRequestContext();
	const links = [
		{
			href: "/",
			label: "Home",
			icon: "pixelarticons--home",
		},
		{
			href: "/peek/list",
			label: "Peek",
			icon: "pixelarticons--avatar-circle",
		},
	] satisfies {
		href: string;
		label: string;
		icon: IconProps["name"];
	}[];

	return (
		<div
			class="megamenu border-base-content/10 not-dark:shadow-sm dark:border"
			hx-on={`htmx:finally:request -> event.detail.ctx.sourceElement.closest("[popover]").hidePopover();`}
			id="megamenu"
			hx-boost:inherited="true"
			popover
		>
			<span class="megamenu-active"></span>

			<button class="w-32" popovertarget="megamenu-menu" type="button">
				<Icon name="pixelarticons--tab" size="size-5" />
				Menu
			</button>
			<div class="dark:border-base-content/10" id="megamenu-menu" popover>
				<div class="flex items-start max-sm:flex-col">
					<ul class="menu md:menu-horizontal w-32 *:w-full">
						{links.map(({ href, label, icon }) => (
							<li>
								{c.req.path === href ? (
									<span>
										<Icon name={icon} />
										{label}
									</span>
								) : (
									<a href={href}>
										<Icon name={icon} />
										{label}
									</a>
								)}
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
};

const ThemeSwitcher = () => {
	const THEME = { light: "latte", dark: "macchiato" } as const;

	return (
		<label
			class="btn btn-square btn-md btn-outline border-base-content/10"
			type="button"
		>
			<div
				class="swap swap-rotate"
				hx-preserve="true"
				hx-on:load={[
					`let theme = localStorage.getItem("theme") ??`,
					`  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "${THEME.dark}" : "${THEME.light}");`,
					`document.documentElement.dataset.theme = theme;`,
					`q("input in this").checked = theme === "${THEME.dark}";`,
				].join("\n")}
			>
				<input
					hx-on:input={[
						`let theme = this.checked ? "${THEME.dark}" : "${THEME.light}";`,
						`localStorage.setItem("theme", theme);`,
						`document.documentElement.dataset.theme = theme;`,
					].join("\n")}
					type="checkbox"
				/>

				<Icon class="swap-off" name="pixelarticons--sun" size="size-5" />
				<Icon class="swap-on" name="pixelarticons--moon" size="size-5" />
			</div>
		</label>
	);
};
