# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report privately via one of:

- **GitHub** → the repository's **Security** tab → **Report a vulnerability** (private advisory), or
- email **yakshgandhi1@gmail.com** with subject `ReviewIQ security`.

Include: a description, steps to reproduce, affected version/commit, and impact. We'll acknowledge
within a few days and keep you updated on the fix.

## Scope

ReviewIQ is self-hosted and single-tenant by default. The most sensitive data it handles is your
**BYOK API keys**. Relevant safeguards:

- Keys are encrypted at rest with AES-256-GCM (`lib/crypto.ts`) before being written to SQLite.
- Keys are never returned to the client in plaintext — only masked (`••••••••1234`).
- The encryption key derives from `APP_SECRET` (or a random per-install secret at
  `DATA_DIR/.app_secret`).

## Hardening notes for operators

- **Set `APP_SECRET`** explicitly on any hosted/multi-instance deploy and store it as a platform
  secret (e.g. `fly secrets set`). Treat `DATA_DIR/.app_secret` and `data/app.db` as sensitive.
- ReviewIQ has **no built-in authentication**. Do not expose a self-host instance to the public
  internet without putting it behind your own auth/proxy.
- Keep dependencies current; native modules (`better-sqlite3`) and Playwright should match their
  pinned versions.
