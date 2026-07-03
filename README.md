<div align="center">

# ReviewIQ

**Chrome Web Store review intelligence — scrape competitor & your own extension reviews, then turn them into insights, replies, positioning, and a buildable roadmap with AI.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-d85a30.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000.svg?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![BYOK](https://img.shields.io/badge/AI-BYOK%20or%20self--host-1d9e75.svg)](#-ai-providers)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-1d9e75.svg)](./CONTRIBUTING.md)

Self-hostable · runs on your own machine · your data and API keys never leave your server.

</div>

![ReviewIQ Insights — AI sentiment & theme comparison of your extension vs competitors](docs/screenshots/insights.png)

---

## Table of contents

- [Why ReviewIQ](#why-reviewiq)
- [Features](#features)
- [Screenshots](#screenshots)
- [Quick start](#-quick-start)
- [AI providers](#-ai-providers)
- [Configuration](#-configuration)
- [How it works](#-how-it-works)
- [Deploy](#-deploy)
- [Project structure](#-project-structure)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Security](#-security)
- [FAQ](#-faq)
- [License](#-license)

---

## Why ReviewIQ

If you build a Chrome extension, your reviews — and your competitors' reviews — are the
most honest product feedback you'll ever get. ReviewIQ pulls them all into one place and
uses an LLM to answer the questions you actually care about: *What do people love? What
breaks? Where are competitors weak? What should I build next? How do I reply to this 1-star
review?*

Everything is **project-scoped**: a project has one extension marked **yours** and any
number of **competitors**. All analysis compares the two.

You bring the AI:

- **Self-host (default):** your local `claude` CLI subscription — **no API key, no per-token cost.**
- **Bring your own key (BYOK):** Anthropic, OpenAI, Fireworks, Moonshot (Kimi), GLM (Zhipu),
  MiniMax, Together, Groq, OpenRouter, Ollama, or **any** OpenAI-compatible endpoint. Keys are
  **encrypted at rest** and never leave your server.

---

## Features

| | Feature | What it does |
|---|---|---|
| 📊 | **Dashboard** | Totals across all projects — extensions tracked, reviews fetched, analyses run. |
| 🧩 | **Extensions** | Add by Web Store URL or ID, mark `mine`/`competitor`, fetch reviews for all at once. |
| 💬 | **Replies** | Drafts a tailored public reply to every review of your extension. |
| 🎯 | **Positioning** | Reads competitors' *negative* reviews → positioning statement, pillars, opportunities, messaging. |
| 💡 | **Insights** | Sentiment + top praises/complaints for you vs. consolidated competitor themes. |
| 📈 | **Trends** | Dated snapshots per fetch → sparklines for rating, ratings, reviews, sentiment + "since last snapshot" deltas. |
| 🗺️ | **Roadmap** | Prioritized, buildable backlog from your complaints, your strengths, and competitor gaps — with evidence quotes. |
| 📝 | **Page Ideas** | 10 SEO landing/blog page ideas grounded in real review demand. |
| 📦 | **Directory Kit** | Copy-paste submission playbook (Product Hunt, BetaList, …) grounded in your site + listing. |
| 🔔 | **Digests** | Scheduled re-scrapes email/webhook you a "what changed" digest — rating moves, new complaints & praises. |
| ⚙️ | **Settings** | Switch AI provider, paste a key (encrypted), test the connection — no code changes. |

---

## Screenshots

**Dashboard** — everything you track at a glance.

![Dashboard](docs/screenshots/dashboard.png)

**Roadmap** — Claude turns your complaints, your strengths, and competitor gaps into a prioritized, buildable backlog with evidence quotes.

![Roadmap](docs/screenshots/roadmap.png)

_(Insights shown at the top.)_

---

## 🚀 Quick start

**Prerequisites**

- Node **20+**
- Playwright Chromium (installed in the step below)
- For the default self-host AI mode: the [`claude` CLI](https://docs.claude.com/en/docs/claude-code)
  installed and logged in (on your `PATH`). _For BYOK, no CLI is needed — just paste a key in Settings._

**Install & run**

```bash
git clone https://github.com/yaksh1/reviewIQ.git
cd reviewiq
npm install
npx playwright install chromium   # one time
npm run dev                       # → http://localhost:3000
```

**First project**

1. Open <http://localhost:3000> → **Projects** → create one.
2. Add your extension (paste a Web Store URL or ID) and mark it **mine**; add competitors.
3. Click **Fetch** to scrape reviews.
4. Open the tabs: **Insights**, **Replies**, **Positioning**, **Roadmap**, …
5. Want to use your own API key instead of `claude -p`? Go to **Settings** → pick a provider → paste key → **Test** → **Save**.

---

## 🤖 AI providers

ReviewIQ never hardcodes a provider. The active one is **resolved in priority order**:

1. **The provider saved in Settings** (`/settings`) — your BYOK choice. The key is encrypted at
   rest (AES-256-GCM) and only ever returned masked.
2. Else an **environment key**: `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`).
3. Else **local `claude -p`** — your Claude Code subscription on this machine, no key.

So the repo runs with **zero config** if you have the `claude` CLI, and anyone can switch to their
own key in the UI without touching code.

**Supported via the Settings dropdown** (`lib/providers.ts`):

`claude -p` · Anthropic · OpenAI · Fireworks · Moonshot (Kimi) · GLM (Zhipu) · MiniMax ·
Together · Groq · OpenRouter · Ollama · any custom OpenAI-compatible `/chat/completions` endpoint.

---

## 🔧 Configuration

All configuration is optional — ReviewIQ runs out of the box.

| Variable | Default | Purpose |
|---|---|---|
| `APP_SECRET` | random, persisted to `DATA_DIR/.app_secret` | Encrypts BYOK keys at rest. **Set explicitly on hosted/multi-instance deploys** so the secret survives volume resets and every instance can decrypt. |
| `DATA_DIR` | `./data` | Where SQLite (`app.db`) and the secret file live. Set to a mounted volume in production (e.g. `/data`). |
| `ANTHROPIC_API_KEY` | — | Server-wide default Anthropic key (used only when Settings is empty). |
| `OPENAI_API_KEY` | — | Server-wide default OpenAI-compatible key. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Base URL for the OpenAI-compatible default. |
| `LLM_MODEL` | provider default | Model id for the env-key default. |
| `PORT` | `3000` | HTTP port. |

Copy [`.env.example`](./.env.example) to `.env.local` if you want to set any of these.

---

## 🧠 How it works

All analysis goes through `runClaude` / `runClaudeJson` (`lib/claude.ts`), which delegate to the
provider layer (`lib/providers.ts`). `runLLM(cfg, prompt)` dispatches on `cfg.kind`:

- `claude-cli` → spawns `claude -p`, pipes the prompt on stdin (self-host, no key).
- `anthropic` → Anthropic Messages API via `fetch`.
- `openai-compatible` → `POST {baseURL}/chat/completions` via `fetch`.

No vendor SDKs — just `fetch`. BYOK settings persist in a `settings` table; the API key is
encrypted (`lib/crypto.ts`) before it touches disk and returned to the UI only masked
(`••••••••2345`).

**Scraping** (`lib/scraper.ts`): navigates to a listing's `…/reviews` page and clicks **Load more**
until the oldest loaded review predates the project's time window (default **2 months**, editable
per-project, 1–120), then filters. AI calls can take 30–120s; the UI shows a spinner.

---

## ☁️ Deploy

The whole app — UI, API routes, the Playwright/Chromium scraper, and SQLite — runs in **one
container**. The repo ships a Fly.io single-box setup that scales to zero when idle.

```bash
fly auth login
fly launch --no-deploy --copy-config --name <your-app-name>
fly volume create data --size 1 --region iad
fly secrets set APP_SECRET=$(openssl rand -hex 32)   # important on hosted deploys
fly deploy
```

See **[DEPLOY.md](./DEPLOY.md)** for the full walkthrough, gotchas, and cost notes.

> **Note:** `claude -p` is **not** available in the hosted container (the CLI isn't installed there),
> so a hosted instance must use the in-app Settings (BYOK) or an env key for AI.

---

## 📁 Project structure

```
app/                  Next.js App Router — pages + API routes
  api/                Route handlers (all `runtime = "nodejs"`)
  settings/           BYOK settings UI
components/           Sidebar, icons, shared UI primitives
lib/
  providers.ts        Multi-provider LLM layer (claude-cli | anthropic | openai-compatible)
  claude.ts           runClaude / runClaudeJson — call sites use these
  settings.ts         DB-backed provider settings (key encrypted)
  crypto.ts           AES-256-GCM encrypt/decrypt for secrets at rest
  scraper.ts          Playwright scraper for the Chrome Web Store
  analysis.ts         All AI analysis prompts (insights, positioning, roadmap, …)
  db.ts               SQLite schema + connection (better-sqlite3)
data/                 SQLite db + .app_secret (gitignored)
Dockerfile, fly.toml  Single-box deploy
```

---

## 🗺️ Roadmap

- [x] Scheduled re-scrapes + trend digests (webhook / email)
- [ ] Export (CSV / Markdown) across all tabs
- [ ] More providers / model presets
- [ ] Multi-tenant accounts + Postgres (for a hosted option)
- [ ] Cloud scraping path (worker + queue) for hosted scale

Have an idea? [Open an issue](../../issues).

### ☁️ Hosted version — coming soon

ReviewIQ is **free to self-host, forever.** A **managed/hosted tier** is in the works — a live app
you sign into (no setup), with always-on monitoring and Slack/email alerts. It's the same open-source
core, run for you, so you don't have to babysit a server or a headless browser.

**Ship, then get pinged when something needs you** — without watching the Web Store:

- 📉 **Email me when my rating drops** (or crosses a threshold), so I catch a bad release early.
- 🆕 **Email me when a new complaint theme appears** — a fresh bug or gap I haven't seen yet.
- 🏆 **Alert me when a competitor's rating tanks or their users revolt** — my opening to win switchers.
- 📈 **Weekly digest of what moved** — new reviews, rising praises/complaints, install trend, all in one email.

**Why hosted, if the code is free?** Self-hosting is great for a one-off analysis or if you live in the
terminal. But keeping it running *well* is real work — and that's what the hosted tier removes:

| | Self-host (free) | Hosted (coming) |
|---|---|---|
| **Scheduled scans run…** | only while your machine/server is on (a laptop can't cron) | **24/7 in the cloud**, even when you're offline |
| **Scraper (Chromium) ops** | you manage ~1GB+ RAM, crashes, version drift, broken selectors | **fully managed** — you never see a browser error |
| **Alerts** | webhook / email you configure yourself (bring your own SMTP/Resend key) | **Slack + email digests** out of the box, nothing to configure |
| **AI key** | bring your own (get a key, paste it, pay per-token) | **managed** — no key juggling, one price |
| **Setup** | clone → install → Playwright → deploy | **sign up → paste an extension ID → done in 60s** |
| **Updates** | `git pull` + redeploy yourself | **always current** |
| **Data** | in your `data/app.db` (your box) | managed, backed up |

**If you'd use the hosted version, ⭐ star the repo** — it's how I'll decide whether to build it. No email needed.

---

## 🤝 Contributing

PRs are welcome. See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for setup, conventions, and the
design-system rules. By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

Good first contributions: re-deriving Web Store selectors when they drift, new provider presets,
new analysis tabs, screenshots for this README.

---

## 🔒 Security

API keys are encrypted at rest and never returned in plaintext. Found a vulnerability? Please
**don't** open a public issue — see **[SECURITY.md](./SECURITY.md)** for private disclosure.

---

## ❓ FAQ

**Do I need an API key?** No. With the `claude` CLI installed, ReviewIQ uses your subscription via
`claude -p`. BYOK is optional and mostly useful for hosted deploys or non-Anthropic models.

**Where is my data?** Local, in `data/app.db`. Nothing is sent anywhere except the AI provider you choose.

**Scraping returned 0 reviews.** The Web Store DOM class names in `lib/scraper.ts` are obfuscated
and change occasionally. Re-derive the selectors (see [CONTRIBUTING.md](./CONTRIBUTING.md)).

**Is scraping allowed?** You're responsible for complying with the Chrome Web Store terms and
applicable law. This tool is for analyzing publicly visible reviews; use it responsibly.

---

## 📄 License

[AGPL-3.0](./LICENSE) © 2026 Yaksh Gandhi

ReviewIQ is open source under the **GNU AGPL v3**. You can self-host and modify it freely; if you
run a modified version as a network service, the AGPL requires you to make your source available to
its users. Contributions are accepted under a [CLA](./CLA.md) so the project can also be offered as a
hosted service. For commercial licensing that isn't AGPL-compatible, contact the maintainer.
