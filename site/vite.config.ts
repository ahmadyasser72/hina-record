import { cloudflareAdapter } from "@pracht/adapter-cloudflare";
import { pracht } from "@pracht/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [pracht({ adapter: cloudflareAdapter() }), tailwindcss()],
});
