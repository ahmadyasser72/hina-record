import { error } from "@sveltejs/kit";

export const proxyBestdori = async (path: string) => {
	const response = await fetch(new URL(path, "https://bestdori.com"));

	if (!response.ok || response.headers.get("content-type") === "text/html")
		error(500, `Request to bestdori @ ${path} failed`);

	return new Response(response.body, {
		status: response.status,
		headers: {
			"Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
			"Content-Length": response.headers.get("Content-Length")!,
			"Cache-Control": "public, max-age=2592000",
			"CDN-Cache-Control": "max-age=2592000",
		},
	});
};
