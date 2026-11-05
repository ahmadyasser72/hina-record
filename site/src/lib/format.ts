import { memoize } from "es-toolkit";

const stripFormatRegex = (() => {
	const keywords = [
		"b",
		"i",
		"c",
		"u",
		"sub",
		"sup",
		"[0-9a-f]{6}",
		"[0-9a-f]{3}",
	];
	return new RegExp(`\\[/?(${keywords.join("|")}).*?\\]`, "gi");
})();
export const stripFormat = memoize((s: string) =>
	s.replace(stripFormatRegex, "").trim(),
);
