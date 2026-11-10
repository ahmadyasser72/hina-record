<script lang="ts">
	import "../app.css";
	import Icon from "@iconify/svelte";
	import { AppBar } from "@skeletonlabs/skeleton-svelte";

	import type { LayoutProps } from "./$types";

	let { children }: LayoutProps = $props();

	const links = [
		{ path: "/tracker", icon: "pixelarticons:calendar-2", label: "Tracker" },
		{ path: "/profiles/list", icon: "pixelarticons:avatar-circle", label: "Profiles" },
	];
</script>

<div class="flex min-h-screen flex-col items-center">
	<AppBar
		class="sticky top-0 border-b border-surface-200-800  bg-surface-100-900/50 backdrop-blur-sm"
	>
		<AppBar.Toolbar class="flex justify-center">
			{#each links as { path, icon, label }}
				<a href={path} class="btn hover:preset-tonal">
					<Icon {icon} class="size-elem-lg" />
					{label}
				</a>
			{/each}
		</AppBar.Toolbar>
	</AppBar>

	<main class="container flex flex-1">
		{@render children?.()}
	</main>
</div>
