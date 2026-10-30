import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { cn } from "cn/vite";
import { defineConfig } from "vite";
import ssrPlugin from "vite-ssr-components/plugin";

export default defineConfig({
	plugins: [cloudflare(), ssrPlugin(), tailwindcss(), cn()],

	resolve: {
		tsconfigPaths: true,
	},
});
