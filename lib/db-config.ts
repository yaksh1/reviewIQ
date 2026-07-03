import { isHosted } from "./hosting";

/*
  Storage backend seam (open-core groundwork).

  ReviewIQ's default and only *implemented* backend today is single-file SQLite
  (better-sqlite3), which is perfect for self-host: zero setup, one box, a file
  on a volume. The hosted/paid tier will need a shared, multi-tenant database
  (Postgres) so many users and multiple app instances can share state.

  This module is the ONE place that decides which backend to use, so the rest of
  the app never sprinkles `process.env.DATABASE_URL` checks around. It does NOT
  implement Postgres yet — it defines the decision + validates config so a hosted
  deploy fails fast instead of silently running on ephemeral SQLite (which would
  lose every user's data on the next container restart).

  Resolution:
   - DATABASE_URL set (postgres://…)  → backend "postgres"  (adapter: future PR)
   - otherwise                        → backend "sqlite"    (self-host default)
*/

export type StorageBackend = "sqlite" | "postgres";

/** The configured storage backend, decided once from the environment. */
export function getStorageBackend(): StorageBackend {
  const url = process.env.DATABASE_URL?.trim();
  if (url && /^postgres(ql)?:\/\//i.test(url)) return "postgres";
  return "sqlite";
}

/** The Postgres connection string, or null when not configured. */
export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url && /^postgres(ql)?:\/\//i.test(url) ? url : null;
}

/**
 * Validate storage config at startup. Throws with a clear message on a
 * dangerous misconfiguration so the operator fixes it before losing data.
 *
 * The dangerous case: a HOSTED deploy (HOSTED=true) with no DATABASE_URL would
 * fall back to SQLite on the container's ephemeral filesystem — every user's
 * data wiped on the next deploy/restart. We refuse that combination.
 *
 * Self-host (HOSTED unset) on SQLite is the normal, supported path — no error.
 */
export function assertStorageConfig(): void {
  const backend = getStorageBackend();

  if (isHosted() && backend === "sqlite") {
    throw new Error(
      "Hosted mode (HOSTED=true) requires a shared database. Set DATABASE_URL to a Postgres " +
        "connection string. Running the hosted tier on single-file SQLite would lose all data " +
        "on the next container restart."
    );
  }

  // Postgres backend selected but the adapter isn't implemented yet: fail loudly
  // rather than pretend. (Removed once the Postgres adapter lands.)
  if (backend === "postgres") {
    throw new Error(
      "DATABASE_URL points at Postgres, but the Postgres storage adapter is not implemented yet. " +
        "Unset DATABASE_URL to use SQLite, or wait for the Postgres adapter."
    );
  }
}

/** Human-readable summary for diagnostics / a future admin/status endpoint. */
export function storageSummary(): { backend: StorageBackend; hosted: boolean; hasDatabaseUrl: boolean } {
  return {
    backend: getStorageBackend(),
    hosted: isHosted(),
    hasDatabaseUrl: !!getDatabaseUrl(),
  };
}
