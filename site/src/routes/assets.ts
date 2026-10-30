import { Hono } from "hono";
import { proxy } from "hono/proxy";

export const assetsApp = new Hono()
	.get("/card-icon/:id{[0-9]+}/:resource/:illust{.+\\.png}", (c) => {
		const chunkId = Math.floor(Number(c.req.param("id")) / 50)
			.toString()
			.padStart(5, "0");
		const resource = c.req.param("resource");
		const illust = c.req.param("illust").replace(".png", "");

		return proxy(
			`https://bestdori.com/assets/en/thumb/chara/card${chunkId}_rip/${resource}_${illust}.png`,
		);
	})
	.get("/card-splash/:resource/:illust{.+\\.png}", (c) => {
		const resource = c.req.param("resource");
		const illust = c.req.param("illust").replace(".png", "");

		return proxy(
			`https://bestdori.com/assets/en/characters/resourceset/${resource}_rip/trim_${illust}.png`,
		);
	})
	.get("/music/:id{[0-9]+}/:jacket{.+\\.png}", (c) => {
		const chunkId = 10 * Math.ceil(Number(c.req.param("id")) / 10);
		const jacket = c.req.param("jacket").replace(".png", "");

		return proxy(
			`https://bestdori.com/assets/en/musicjacket/musicjacket${chunkId}_rip/assets-star-forassetbundle-startapp-musicjacket-musicjacket${chunkId}-${jacket.toLowerCase()}-jacket.png`,
		);
	});
