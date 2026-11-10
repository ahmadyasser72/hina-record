import type { Handle } from "@sveltejs/kit/hooks";

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event, {
		preload: (asset) => {
			if (asset.type === "font") {
				return (
					asset.filename ===
					"node_modules/@fontsource/comic-relief/files/comic-relief-latin-400-normal.woff2"
				);
			}

			return true;
		},
	});
};
