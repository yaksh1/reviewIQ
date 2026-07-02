# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **BYOK settings UI** (`/settings`): choose the AI provider, paste a key, test the connection,
  and clear it — no code changes required.
- Multi-provider LLM layer (`lib/providers.ts`): `claude -p`, Anthropic Messages API, and any
  OpenAI-compatible endpoint, with presets for OpenAI, Fireworks, Moonshot, GLM, MiniMax,
  Together, Groq, OpenRouter, and Ollama.
- Encrypted-at-rest API keys (AES-256-GCM, `lib/crypto.ts`); keys are returned to the client only
  masked. Encryption key from `APP_SECRET` or a generated per-install secret.
- DB-backed settings store (`settings` table, `lib/settings.ts`).
- **Build-in-public page** at `/p` (no sidebar): hero, live-stats strip with 7-day deltas, and an
  apps grid with sparklines. Mine-only — competitor data is never shown. Editable profile + publish
  toggle under Settings. Backed by `lib/portfolio.ts` aggregating the existing `snapshots` table.
- **Automatic re-scrape scheduler** (`lib/scheduler.ts`, started from `instrumentation.ts`): re-scrapes
  every project on a configurable interval and records dated snapshots, so Trends + public deltas
  move over time. Configurable + "Run now" under Settings.
- **Private metrics via Google Analytics**: upload a GA4 **service-account JSON** key (encrypted at
  rest) and map a property per extension; the app pulls active users, new users, page views, sessions,
  daily time-series, country geo, traffic sources, and top pages from the GA4 Data API (`lib/ga.ts` +
  `lib/google-auth.ts` — signed-JWT token mint, no SDK, works headless/hosted). Powers the public
  `/p/stats` dashboard and per-app pages. `ga_metrics` table.
  - The Chrome Web Store dev-console scrape + manual-entry path was removed: the console has no read
    API and the authenticated scrape was too fragile (Google login/bot-protection). Google Analytics
    is the reliable source and covers traffic/geo/sources.
- Open-source kit: README, LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, `.env.example`,
  and GitHub issue/PR templates.

### Changed
- Provider resolution order is now **Settings → environment keys → `claude -p`**.

## [0.1.0]

### Added
- Initial app: project-scoped Chrome Web Store review scraping (Playwright) and AI analysis —
  Dashboard, Extensions, Reviews/Replies, Insights, Positioning, Trends, Roadmap, Page Ideas,
  and Directory Kit.
- Single-box Fly.io deploy (Dockerfile + fly.toml) with SQLite on a persistent volume.
