// `Env` and `ExecutionContext` come from worker-configuration.d.ts, which
// `wrangler types` generates. Rerun it after changing wrangler.jsonc.
import "@pracht/core";

declare module "@pracht/core" {
	interface Register {
		context: {
			env: Env;
			executionContext: ExecutionContext;
		};
	}
}
