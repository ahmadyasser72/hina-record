import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
	project: "proj_wdpzvybnzuekyeleptli",
	dirs: ["./src/trigger"],
	runtime: "bun-1.4",
	machine: "micro",
	logLevel: "log",
	maxDuration: 3600,
	retries: {
		default: {
			factor: 2,
			maxAttempts: 3,
			maxTimeoutInMs: 10000,
			minTimeoutInMs: 1000,
			randomize: true,
		},
		enabledInDev: true,
	},
});
