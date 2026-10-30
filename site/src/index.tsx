import { showRoutes } from "hono/dev";

import { notFound } from "./error";
import { factory } from "./factory";
import { renderer } from "./renderer";
import { assetsApp } from "./routes/assets";
import { peekApp } from "./routes/peek";

const app = factory
	.createApp()
	.use(renderer)
	.notFound(notFound)
	.route("/assets", assetsApp)
	.route("/peek", peekApp);

if (import.meta.env.DEV) showRoutes(app);

export default app;
