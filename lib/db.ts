import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { assertStorageConfig } from "./db-config";

/*
  Storage: single-file SQLite (better-sqlite3). This is the self-host default and
  the only implemented backend today. The backend choice lives in lib/db-config;
  getDb() is the single branch point where a future Postgres adapter would hook
  in. Keeping that decision in one place is the groundwork for the hosted tier.
*/

// DATA_DIR is the mounted volume in production (e.g. /data on Fly), or ./data locally.
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "app.db");

// Single connection reused across hot reloads in dev.
declare global {
  var __db: Database.Database | undefined;
}

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      months_back INTEGER NOT NULL DEFAULT 2,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS extensions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      ext_id       TEXT NOT NULL,
      name         TEXT DEFAULT '',
      slug         TEXT DEFAULT '',
      icon         TEXT DEFAULT '',
      rating       REAL,
      rating_count INTEGER,
      users        TEXT DEFAULT '',
      description  TEXT DEFAULT '',
      category     TEXT DEFAULT '',
      website      TEXT DEFAULT '',
      role         TEXT NOT NULL DEFAULT 'competitor', -- 'mine' | 'competitor'
      last_fetched TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, ext_id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      extension_id INTEGER NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
      review_uid   TEXT,
      author       TEXT DEFAULT '',
      rating       INTEGER,
      body         TEXT DEFAULT '',
      date         TEXT DEFAULT '',
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(extension_id, review_uid)
    );

    CREATE TABLE IF NOT EXISTS review_replies (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id  INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      reply      TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(review_id)
    );

    -- generic per-project AI artifacts: insights, positioning
    CREATE TABLE IF NOT EXISTS analyses (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind       TEXT NOT NULL,        -- 'insights' | 'positioning' | 'roadmap'
      data       TEXT NOT NULL,        -- JSON
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, kind)
    );

    -- Generated content-marketing page ideas for "mine" extensions.
    CREATE TABLE IF NOT EXISTS page_ideas (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      extension_id INTEGER NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
      project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      data         TEXT NOT NULL,      -- JSON array of ideas
      grounded     INTEGER NOT NULL DEFAULT 0, -- 1 = used insights/reviews, 0 = fallback
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(extension_id)
    );

    -- Generated directory-submission playbook for "mine" extensions.
    CREATE TABLE IF NOT EXISTS directory_kits (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      extension_id INTEGER NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
      project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      website      TEXT DEFAULT '',
      data         TEXT NOT NULL,      -- JSON kit
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(extension_id)
    );

    -- Dated point-in-time snapshots for trend tracking (one row per capture).
    CREATE TABLE IF NOT EXISTS snapshots (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      extension_id  INTEGER NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
      project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      rating        REAL,
      rating_count  INTEGER,
      users         TEXT DEFAULT '',
      review_count  INTEGER,            -- reviews stored at capture time
      sentiment     TEXT DEFAULT '',    -- JSON {positive,neutral,negative} | '' until insights run
      themes        TEXT DEFAULT '',    -- JSON {praises:[{theme,count}], complaints:[...]} | ''
      captured_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_ext ON snapshots(extension_id, captured_at);

    -- Generic key/value app settings (e.g. the active LLM provider config).
    -- Single-tenant for now; values are JSON. Secrets inside are encrypted.
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,        -- JSON
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Google Analytics (GA4) metrics per extension, fetched via the Data API
    -- using an uploaded service-account key. Dated so they trend over time.
    CREATE TABLE IF NOT EXISTS ga_metrics (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ext_id        TEXT NOT NULL,
      property_id   TEXT NOT NULL,
      range_days    INTEGER,
      active_users  INTEGER,
      new_users     INTEGER,
      page_views    INTEGER,
      sessions      INTEGER,
      geo           TEXT DEFAULT '',   -- JSON [{country, users}]
      report        TEXT DEFAULT '',   -- JSON GaFull blob (series, sources, top pages)
      captured_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ga_metrics_ext ON ga_metrics(ext_id, captured_at);
  `);

  // Migrations for pre-existing tables.
  // The private CWS dev-console metrics feature was removed; drop its table.
  db.exec("DROP TABLE IF EXISTS cws_metrics");

  const pcols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!pcols.some((c) => c.name === "months_back")) {
    db.exec("ALTER TABLE projects ADD COLUMN months_back INTEGER NOT NULL DEFAULT 2");
  }
  const ecols = db.prepare("PRAGMA table_info(extensions)").all() as { name: string }[];
  if (!ecols.some((c) => c.name === "description")) {
    db.exec("ALTER TABLE extensions ADD COLUMN description TEXT DEFAULT ''");
  }
  if (!ecols.some((c) => c.name === "category")) {
    db.exec("ALTER TABLE extensions ADD COLUMN category TEXT DEFAULT ''");
  }
  if (!ecols.some((c) => c.name === "website")) {
    db.exec("ALTER TABLE extensions ADD COLUMN website TEXT DEFAULT ''");
  }

  // ga_metrics gained new_users + report after first ship.
  const gcols = db.prepare("PRAGMA table_info(ga_metrics)").all() as { name: string }[];
  if (gcols.length) {
    if (!gcols.some((c) => c.name === "new_users")) {
      db.exec("ALTER TABLE ga_metrics ADD COLUMN new_users INTEGER");
    }
    if (!gcols.some((c) => c.name === "report")) {
      db.exec("ALTER TABLE ga_metrics ADD COLUMN report TEXT DEFAULT ''");
    }
  }
}

/**
 * The database handle. Single branch point for the storage backend.
 *
 * Today this always returns the SQLite connection. `assertStorageConfig()`
 * throws first if the environment selects an unimplemented/dangerous backend
 * (e.g. hosted mode without DATABASE_URL, or DATABASE_URL set before the
 * Postgres adapter exists), so we never silently open the wrong store.
 *
 * When the Postgres adapter lands, it branches here on getStorageBackend().
 */
export function getDb(): Database.Database {
  if (!global.__db) {
    // Fail fast on a dangerous storage misconfiguration. After this, the backend
    // is guaranteed "sqlite" (assert throws for postgres/hosted-without-url).
    assertStorageConfig();
    const db = new Database(DB_PATH);
    init(db);
    global.__db = db;
  }
  return global.__db;
}
