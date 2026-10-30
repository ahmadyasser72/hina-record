import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
	dirs: ["./src/trigger"],
	logLevel: "log",
	machine: "micro",
	maxDuration: 3600,
	project: "proj_wdpzvybnzuekyeleptli",
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
	runtime: "node-26",
});
