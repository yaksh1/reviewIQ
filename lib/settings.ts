import { getDb } from "./db";
import { encryptSecret, decryptSecret, maskSecret } from "./crypto";
import type { ProviderConfig, ProviderKind } from "./providers";

/*
  DB-backed app settings. Currently the only setting is the active LLM provider
  ("llm_provider"), persisted single-tenant. The API key is encrypted at rest
  via lib/crypto and never returned to the client in plaintext.
*/

const PROVIDER_KEY = "llm_provider";

/** What we persist: a ProviderConfig but with the apiKey encrypted. */
interface StoredProvider {
  kind: ProviderKind;
  apiKeyEnc?: string; // encrypted; absent when no key
  baseURL?: string;
  model?: string;
}

/** Masked view safe to return to the client (no plaintext secret). */
export interface ProviderSettingsView {
  kind: ProviderKind;
  hasKey: boolean;
  keyMasked: string; // "" when no key
  baseURL: string;
  model: string;
}

function readStored(): StoredProvider | null {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(PROVIDER_KEY) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as StoredProvider;
  } catch {
    return null;
  }
}

/** Masked settings for the UI. Returns null if nothing has been saved yet. */
export function getProviderSettingsView(): ProviderSettingsView | null {
  const s = readStored();
  if (!s) return null;
  const key = s.apiKeyEnc ? decryptSecret(s.apiKeyEnc) : "";
  return {
    kind: s.kind,
    hasKey: !!key,
    keyMasked: key ? maskSecret(key) : "",
    baseURL: s.baseURL || "",
    model: s.model || "",
  };
}

/** Fully resolved (decrypted) provider config, or null if unset. Server-only. */
export function getStoredProviderConfig(): ProviderConfig | null {
  const s = readStored();
  if (!s) return null;
  const apiKey = s.apiKeyEnc ? decryptSecret(s.apiKeyEnc) : undefined;
  return { kind: s.kind, apiKey, baseURL: s.baseURL, model: s.model };
}

/**
 * Save the provider settings.
 * `apiKey` semantics:
 *   - string with content → encrypt and store (new key)
 *   - undefined           → keep the previously stored key (edit without re-entering)
 *   - "" (empty string)   → explicitly clear the key
 */
export function saveProviderSettings(input: {
  kind: ProviderKind;
  apiKey?: string;
  baseURL?: string;
  model?: string;
}): void {
  const prev = readStored();

  let apiKeyEnc: string | undefined;
  if (input.apiKey === undefined) {
    apiKeyEnc = prev?.apiKeyEnc; // unchanged
  } else if (input.apiKey === "") {
    apiKeyEnc = undefined; // cleared
  } else {
    apiKeyEnc = encryptSecret(input.apiKey);
  }

  const stored: StoredProvider = {
    kind: input.kind,
    apiKeyEnc,
    baseURL: input.baseURL?.trim() || undefined,
    model: input.model?.trim() || undefined,
  };

  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .run(PROVIDER_KEY, JSON.stringify(stored));
}

/* -------------------------------------------------------------------------- */
/* Public "build in public" profile                                          */
/* -------------------------------------------------------------------------- */

const PUBLIC_PROFILE_KEY = "public_profile";

/** Editable profile that powers the public /p page. No secrets here. */
export interface PublicProfile {
  enabled: boolean; // master switch — when false the public page returns 404-ish empty
  name: string; // your name / handle
  tagline: string; // e.g. "Coding my way to $100k"
  goal: string; // free text, e.g. "$100k USD"
  profit: string; // header banner profit figure (free text, e.g. "$0")
  startDate: string; // ISO date the journey began; powers a "days in" counter
  youtube: string; // optional URL
  twitter: string; // optional URL
  website: string; // optional URL
}

const DEFAULT_PUBLIC_PROFILE: PublicProfile = {
  enabled: false,
  name: "",
  tagline: "",
  goal: "",
  profit: "",
  startDate: "",
  youtube: "",
  twitter: "",
  website: "",
};

export function getPublicProfile(): PublicProfile {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(PUBLIC_PROFILE_KEY) as { value: string } | undefined;
  if (!row) return { ...DEFAULT_PUBLIC_PROFILE };
  try {
    return { ...DEFAULT_PUBLIC_PROFILE, ...(JSON.parse(row.value) as Partial<PublicProfile>) };
  } catch {
    return { ...DEFAULT_PUBLIC_PROFILE };
  }
}

export function savePublicProfile(input: Partial<PublicProfile>): PublicProfile {
  const merged: PublicProfile = { ...getPublicProfile(), ...input };
  // Trim string fields.
  for (const k of Object.keys(merged) as (keyof PublicProfile)[]) {
    if (typeof merged[k] === "string") (merged[k] as string) = (merged[k] as string).trim();
  }
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .run(PUBLIC_PROFILE_KEY, JSON.stringify(merged));
  return merged;
}

/* ---- Per-extension public meta (the header badges on his per-app page) ---- */

const EXT_META_KEY = "ext_meta";

export interface ExtMeta {
  builtIn: string; // "Built & deployed in" — free text e.g. "3 days"
  prompts: string; // "Prompts" count/note
  price: string; // "Free", "$4/mo", etc.
  created: string; // created date (free text or ISO)
}

const DEFAULT_EXT_META: ExtMeta = { builtIn: "", prompts: "", price: "", created: "" };

export function getExtMetaAll(): Record<string, ExtMeta> {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(EXT_META_KEY) as
    | { value: string }
    | undefined;
  if (!row) return {};
  try {
    return JSON.parse(row.value) as Record<string, ExtMeta>;
  } catch {
    return {};
  }
}

export function getExtMeta(extId: string): ExtMeta {
  return { ...DEFAULT_EXT_META, ...(getExtMetaAll()[extId] || {}) };
}

export function saveExtMeta(extId: string, input: Partial<ExtMeta>): ExtMeta {
  const all = getExtMetaAll();
  const merged: ExtMeta = { ...DEFAULT_EXT_META, ...(all[extId] || {}), ...input };
  for (const k of Object.keys(merged) as (keyof ExtMeta)[]) merged[k] = (merged[k] || "").trim();
  all[extId] = merged;
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .run(EXT_META_KEY, JSON.stringify(all));
  return merged;
}

/* -------------------------------------------------------------------------- */
/* Scheduler — automatic periodic re-scrape of all projects                  */
/* -------------------------------------------------------------------------- */

const SCHEDULE_KEY = "schedule";

export interface ScheduleConfig {
  enabled: boolean;
  intervalHours: number; // how often to re-scrape all projects
}

const DEFAULT_SCHEDULE: ScheduleConfig = { enabled: false, intervalHours: 24 };

export function getSchedule(): ScheduleConfig {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(SCHEDULE_KEY) as { value: string } | undefined;
  if (!row) return { ...DEFAULT_SCHEDULE };
  try {
    const parsed = JSON.parse(row.value) as Partial<ScheduleConfig>;
    const intervalHours = Math.min(720, Math.max(1, Number(parsed.intervalHours) || 24));
    return { enabled: !!parsed.enabled, intervalHours };
  } catch {
    return { ...DEFAULT_SCHEDULE };
  }
}

export function saveSchedule(input: Partial<ScheduleConfig>): ScheduleConfig {
  const merged: ScheduleConfig = { ...getSchedule(), ...input };
  merged.intervalHours = Math.min(720, Math.max(1, Number(merged.intervalHours) || 24));
  merged.enabled = !!merged.enabled;
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .run(SCHEDULE_KEY, JSON.stringify(merged));
  return merged;
}

/* -------------------------------------------------------------------------- */
/* Google Analytics — service-account key + per-extension property mapping    */
/* -------------------------------------------------------------------------- */

const GA_KEY = "ga_config";

interface StoredGa {
  saJsonEnc?: string; // encrypted service-account JSON
  clientEmail?: string; // shown to the user so they know which SA to grant access
  properties?: Record<string, string>; // ext_id → GA4 property id
}

export interface GaConfigView {
  hasKey: boolean;
  clientEmail: string;
  properties: Record<string, string>;
}

function readGa(): StoredGa {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(GA_KEY) as
    | { value: string }
    | undefined;
  if (!row) return {};
  try {
    return JSON.parse(row.value) as StoredGa;
  } catch {
    return {};
  }
}

function writeGa(g: StoredGa) {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .run(GA_KEY, JSON.stringify(g));
}

/** Masked view for the UI: whether a key exists + which SA email + property map. */
export function getGaConfigView(): GaConfigView {
  const g = readGa();
  return {
    hasKey: !!g.saJsonEnc,
    clientEmail: g.clientEmail || "",
    properties: g.properties || {},
  };
}

/** Decrypted service-account JSON string, or null. Server-only. */
export function getGaServiceAccountJson(): string | null {
  const g = readGa();
  return g.saJsonEnc ? decryptSecret(g.saJsonEnc) || null : null;
}

export function getGaProperties(): Record<string, string> {
  return readGa().properties || {};
}

/**
 * Save the GA service-account JSON (encrypted). `saJson` undefined = keep existing,
 * "" = clear. `clientEmail` is stored alongside (non-secret) for display.
 */
export function saveGaServiceAccount(saJson: string | undefined, clientEmail?: string): void {
  const g = readGa();
  if (saJson === undefined) {
    // keep
  } else if (saJson === "") {
    delete g.saJsonEnc;
    delete g.clientEmail;
  } else {
    g.saJsonEnc = encryptSecret(saJson);
    if (clientEmail) g.clientEmail = clientEmail;
  }
  writeGa(g);
}

/** Set (or clear, with "") the GA4 property id for one extension. */
export function setGaProperty(extId: string, propertyId: string): void {
  const g = readGa();
  g.properties = g.properties || {};
  const clean = propertyId.trim().replace(/^properties\//, "");
  if (clean) g.properties[extId] = clean;
  else delete g.properties[extId];
  writeGa(g);
}
