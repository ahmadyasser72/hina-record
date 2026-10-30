export function GET() {
	return Response.json({
		adapter: "cf",
		ok: true,
		service: "pracht",
	});
}
