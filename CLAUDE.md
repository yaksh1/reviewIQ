# ReviewIQ — notes for AI coding agents

See [README.md](./README.md) for the overview and [CONTRIBUTING.md](./CONTRIBUTING.md) for setup,
conventions, and the design-system rules.

Quick facts:

- Next.js 16 (App Router) + TypeScript, SQLite via `better-sqlite3`, Playwright for scraping.
- All API routes use `export const runtime = "nodejs"`.
- AI goes through `lib/providers.ts` (`runLLM`) via `lib/claude.ts` — never call a provider directly.
- Gates before a PR: `npm run lint` and `npm run build` must pass.
- Don't commit secrets, `data/`, or `.next/`.
