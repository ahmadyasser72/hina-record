import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
	project: "proj_wdpzvybnzuekyeleptli",
	runtime: "node-26",
	logLevel: "log",
	machine: "micro",
	maxDuration: 3600,
	retries: {
		enabledInDev: true,
		default: {
			maxAttempts: 3,
			minTimeoutInMs: 1000,
			maxTimeoutInMs: 10000,
			factor: 2,
			randomize: true,
		},
	},
	dirs: ["./src/trigger"],
});
