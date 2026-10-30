# site

This pracht starter is configured for Cloudflare Workers.

## Commands

- `bun install`
- `bun dev`
- `bun run build`
- `bun typecheck`
- `bun preview`
- `bun run deploy`
- `bun run cf-typegen`

Edit `wrangler.jsonc` to add KV, D1, R2, cron triggers, or other Cloudflare bindings, then run `bun run cf-typegen` so `context.env` is typed with them.

## Files

- `src/routes.ts` defines your app manifest.
- `src/routes/home.tsx` is the first page.
- `src/routes/not-found.tsx` is the not-found page, wired via `notFound`.
- `src/api/health.ts` is a sample API route.
- `tsconfig.json` — server-capable whole-project TypeScript checks.
- `tsconfig.client.json` — browser-conditioned checks for routes, shells, islands, and their imports.
- `src/styles/global.css` is the Tailwind CSS entry, imported by the shell.
- `.claude/skills/` and `.mcp.json` wire up the pracht Claude Code skills and MCP server.

## Skills

`.claude/skills/` holds the 4 core skills: `/pracht-scaffold`, `/pracht-debug`, `/pracht-deploy`, `/upgrade-pracht`.

The rest of the catalog — audits, testing scaffolds, and the `add-*` integrations — is published at [`/.well-known/agent-skills/index.json`](https://pracht.resynapse.dev/.well-known/agent-skills/index.json). Install what you need:

```bash
pracht skills list
pracht skills add audit-loaders add-db
```

## Navigating

Pracht navigates by route id, not by path: `<Link route="home">`, `href("home")`, `navigate({ route: "home" })`. Dynamic routes take their segments through `params`. The id survives a path change, and `pracht typegen` types both the id and its params — so `<Link href>` is a compile error. Use a plain `<a href>` for external and user-provided URLs.

## Checks

- `pracht verify` validates routes and constraints.
- `pracht plan --write` commits an app-graph snapshot to `.pracht/`; `pracht plan` diffs against it.
- `pracht report` prints a PR-ready summary of both.
