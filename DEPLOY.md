# Deploy (single-box on Fly.io)

The whole app — Next.js UI, API routes, the Playwright/Chromium scraper, and the
SQLite database — runs in one container. Simplest hosting that keeps the scraper
working unchanged. Scales to zero when idle (~$0), wakes on the next request.

## Files involved
- `Dockerfile` — Playwright base image (Chromium + libs) + Next standalone build.
- `fly.toml` — app config + persistent volume for SQLite.
- `next.config.ts` — `output: "standalone"` for a lean image.
- DB path is `DATA_DIR` (defaults to `./data` locally, `/data` on the volume).

## One-time setup
```bash
# 1. Install the CLI and sign in
#    (macOS) brew install flyctl   |   (Windows) iwr https://fly.io/install.ps1 -useb | iex
fly auth login

# 2. Create the app (don't deploy yet). Pick a unique name; update `app` in fly.toml.
fly launch --no-deploy --copy-config --name <your-app-name>

# 3. Create the persistent volume that holds data/app.db (same region as the app).
fly volume create data --size 1 --region iad
```

## Deploy
```bash
fly deploy
```
First deploy builds the Docker image remotely (a few minutes — it pulls the
Playwright image which is large). Subsequent deploys are faster (layer cache).

## Verify after deploy
```bash
fly logs                     # watch startup; should see Next ready on :3000
fly open                     # open the app
# In the app: create a project, add an extension, click Fetch. Watch `fly logs`
# for the scrape. If Chromium fails, logs will show a launch error.
```

## Cost / scaling
- `min_machines_running = 0` + `auto_stop_machines` → idle costs ~$0; a request
  wakes the machine (a few seconds cold start, plus Chromium launch).
- 1GB RAM is the floor for a reliable scrape. If scrapes OOM, bump `[[vm]] memory`.
- This is single-box: concurrent scrapes share one Chromium. When that becomes a
  bottleneck, graduate to a worker+queue (architecture "C") — `scrapeExtension()`
  is already isolated, so that's an additive change, not a rewrite.

## Verified locally
The Docker image was built and run end-to-end: the container boots, serves the
UI (`GET /` → 200), reads/writes SQLite on `/data` (`/api/stats` → 200), and
**the Chromium scraper runs inside the container** — a real fetch of uBlock
Origin returned 12 reviews with no browser errors.

Key gotcha already handled: packages in `serverExternalPackages`
(`better-sqlite3`, `playwright`, `playwright-core`) are excluded from Next's
standalone trace, so the Dockerfile copies all of them explicitly into the
runner stage. Miss any and you get `Cannot find module '.../browsers.json'`.

If a future `fly deploy` fails, likely culprits and fixes:
- **better-sqlite3 "invalid ELF / not found"** → the native module didn't copy or
  was built for the wrong platform. Fix: in the Dockerfile runner stage, instead
  of copying the three module folders, run `npm rebuild better-sqlite3` after a
  full `npm ci --omit=dev`. (Heavier image, but bulletproof.)
- **"browserType.launch: Executable doesn't exist"** → base image tag and
  `playwright` version drifted. Keep `Dockerfile` tag == `package.json` version.
- **DB resets on redeploy** → the volume isn't mounted; confirm `fly volume list`
  shows `data` and `fly.toml` `[mounts]` destination is `/data`.

## Env vars to set on Fly

```bash
# Encrypts BYOK keys at rest. Set this explicitly on any hosted/multi-instance
# deploy so the secret survives volume resets and all machines can decrypt.
# (If unset, a random secret is generated and stored at /data/.app_secret.)
fly secrets set APP_SECRET=$(openssl rand -hex 32)
```

AI provider, in priority order:
1. Whatever is saved in the in-app **Settings** page (BYOK — recommended for a
   hosted instance; keys stored encrypted in the DB).
2. An env key below (a server-wide default for every user of the instance).
3. Local `claude -p` — works on a self-host box where you've logged into the CLI,
   but **not** in this Fly container (the CLI isn't installed there), so a hosted
   deploy must use Settings or an env key.

```bash
# Optional server-wide default key (used when Settings is empty):
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
# or any OpenAI-compatible provider:
fly secrets set OPENAI_API_KEY=... OPENAI_BASE_URL=https://api.fireworks.ai/inference/v1
```
