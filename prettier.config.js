/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
	trailingComma: "all",
	semi: true,
	singleQuote: false,
	useTabs: true,

	plugins: [
		"prettier-plugin-packagejson",
		"@ianvs/prettier-plugin-sort-imports",
	],

	importOrder: [
		"<BUILTIN_MODULES>",
		"",
		"^cloudflare:workers$",
		"",
		"<THIRD_PARTY_MODULES>",
		"",
		"^@hina-record/.+",
		"^#.+",
		"^[.]",
	],
};

export default config;
