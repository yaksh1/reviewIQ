# Contributing to ReviewIQ

Thanks for your interest! This project is small and approachable — issues and PRs are welcome.

## License & Contributor License Agreement (CLA)

ReviewIQ is licensed under the **GNU AGPL v3** (see [LICENSE](./LICENSE)). By submitting a pull
request, you agree to the **[Contributor License Agreement](./CLA.md)**: you certify you wrote the
contribution (or have the right to submit it) and grant the maintainer a license to use it, including
in a commercially hosted version of ReviewIQ. This is standard for open-core projects (Cal.com,
Postiz, Supabase all do the same) and is what lets the project stay free to self-host while also being
offered as a paid hosted service. A CLA bot will ask first-time contributors to sign on their first PR.

## Code of Conduct

By participating you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting set up

```bash
git clone https://github.com/<you>/reviewiq.git
cd reviewiq
npm install
npx playwright install chromium
npm run dev      # http://localhost:3000
```

No environment variables are required to develop. The app uses your local `claude` CLI by
default; to test a BYOK path, set a key in **Settings** (`/settings`) or in `.env.local`
(see [`.env.example`](./.env.example)).

## Before you open a PR

```bash
npm run lint     # eslint
npm run build    # type-checks + production build (the bar that must pass)
```

- Keep PRs focused — one feature or fix per PR.
- Match the surrounding code style; no new dependencies without a reason in the PR description.
- All API routes must keep `export const runtime = "nodejs"` (native deps + Playwright need Node).
- Don't commit secrets, `data/`, or `.next/`.

## Architecture cheat-sheet

| Area | File | Notes |
|---|---|---|
| LLM layer | `lib/providers.ts` | `runLLM` dispatches on `claude-cli` / `anthropic` / `openai-compatible`. Add new providers to `PROVIDER_PRESETS`. |
| Call sites | `lib/claude.ts` | Everything calls `runClaude` / `runClaudeJson`; don't call providers directly. |
| Settings/BYOK | `lib/settings.ts`, `lib/crypto.ts` | Keys encrypted at rest; never log or return them in plaintext. |
| Scraper | `lib/scraper.ts` | Playwright; Web Store DOM selectors are obfuscated. |
| Analysis prompts | `lib/analysis.ts` | One function per tab; returns typed JSON. |
| DB | `lib/db.ts` | SQLite via better-sqlite3. **Adding a table?** Restart `npm run dev` — the connection is cached on `global.__db`, so schema changes don't apply to a running server. |

## Design system

The UI is **"Coral on Near-Black"** (see `app/globals.css`). Please keep to it:

- Single coral accent (`--accent`), strict gray hierarchy, near-black layered background.
- Elevation via lightness + border opacity — **no drop shadows, no gradients**.
- Fonts: **Geist** (UI) + **Geist Mono** (numbers/ratings/counts via `.mono`).
- **No emoji in the UI** — use the hairline SVG icon set in `components/icons.tsx`.
- Reuse utility classes (`.card`, `.btn`, `.input`, `.badge`, `.eyebrow`, …) and primitives in `components/ui.tsx`.

## Adding a provider

1. Add a `ProviderPreset` to `PROVIDER_PRESETS` in `lib/providers.ts` (most are `openai-compatible`).
2. If it needs a non-standard transport, add a `runX` function and a `case` in `runLLM`.
3. Test it from **Settings → Test connection**.

## Fixing the scraper

Web Store class names are obfuscated and drift over time. If a scrape returns 0 reviews:

1. Open a Web Store `…/reviews` page in a browser and inspect a review card.
2. Update the selectors at the top of `lib/scraper.ts` (review card, author, rating, date, body).
3. Verify with a real fetch, and note the date you re-derived them in the PR.

## Reporting bugs / requesting features

Use the [issue templates](../../issues/new/choose). Include repro steps, expected vs. actual,
and your OS / Node version.
