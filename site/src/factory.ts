import { createFactory } from "hono/factory";

export interface Env {
	Variables: {
		title?: string;
	};
}

export const factory = createFactory<Env>();
