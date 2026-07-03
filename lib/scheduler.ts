import { fetchAllProjects } from "./fetch-project";
import { getSchedule } from "./settings";
import { deliverDigests } from "./notify";

/*
  In-process re-scrape scheduler (single-box model). A setInterval ticks every
  minute and runs a full re-scrape of all projects when the configured interval
  has elapsed. Snapshots accumulate, which is what makes the Trends + public
  live-stats deltas actually move over time.

  Runtime state is parked on globalThis so Next.js hot-reload / multiple imports
  don't spawn duplicate timers. Config (enabled + intervalHours) lives in the
  settings table; call reloadScheduler() after changing it.
*/

interface SchedulerState {
  timer: NodeJS.Timeout | null;
  running: boolean; // a scrape is in flight (prevents overlap)
  lastRun: string | null; // ISO
  nextRun: string | null; // ISO
  lastResult: { projects: number; ok: number; failed: number } | null;
  lastError: string | null;
  lastDigest: { channel: string; sent: number; skipped: boolean; error?: string } | null;
}

declare global {
  var __scheduler: SchedulerState | undefined;
}

function state(): SchedulerState {
  if (!globalThis.__scheduler) {
    globalThis.__scheduler = {
      timer: null,
      running: false,
      lastRun: null,
      nextRun: null,
      lastResult: null,
      lastError: null,
      lastDigest: null,
    };
  }
  return globalThis.__scheduler;
}

const TICK_MS = 60_000; // check once a minute

/** Run a full re-scrape now (guards against overlapping runs). */
export async function runScrapeNow(): Promise<void> {
  const s = state();
  if (s.running) return;
  s.running = true;
  s.lastError = null;
  try {
    const results = await fetchAllProjects();
    const ok = results.reduce((n, p) => n + p.results.filter((r) => r.ok).length, 0);
    const failed = results.reduce((n, p) => n + p.results.filter((r) => !r.ok).length, 0);
    s.lastResult = { projects: results.length, ok, failed };
    s.lastRun = new Date().toISOString();

    // Deliver a "what changed" digest after the scrape. Fresh snapshots exist
    // now, so the digest reflects this run. Delivery is a no-op unless a channel
    // is configured; never let a delivery failure fail the scrape.
    try {
      const d = await deliverDigests();
      s.lastDigest = { channel: d.channel, sent: d.sent, skipped: d.skipped, error: d.error };
    } catch (e) {
      s.lastDigest = { channel: "?", sent: 0, skipped: false, error: e instanceof Error ? e.message : String(e) };
    }
  } catch (e) {
    s.lastError = e instanceof Error ? e.message : String(e);
  } finally {
    s.running = false;
  }
}

function computeNextRun(intervalHours: number): string {
  const s = state();
  const base = s.lastRun ? new Date(s.lastRun).getTime() : Date.now();
  return new Date(base + intervalHours * 3_600_000).toISOString();
}

/** Start/refresh the scheduler from current settings. Idempotent. */
export function reloadScheduler(): void {
  const s = state();
  if (s.timer) {
    clearInterval(s.timer);
    s.timer = null;
  }

  const cfg = getSchedule();
  if (!cfg.enabled) {
    s.nextRun = null;
    return;
  }

  s.nextRun = computeNextRun(cfg.intervalHours);

  s.timer = setInterval(async () => {
    const c = getSchedule();
    if (!c.enabled) {
      reloadScheduler(); // settings changed under us → tear down
      return;
    }
    if (s.running) return;
    if (s.nextRun && Date.now() >= new Date(s.nextRun).getTime()) {
      await runScrapeNow();
      s.nextRun = computeNextRun(c.intervalHours);
    }
  }, TICK_MS);

  // Let the process exit even if the timer is pending (don't block shutdown).
  if (typeof s.timer.unref === "function") s.timer.unref();
}

export interface SchedulerStatus {
  enabled: boolean;
  intervalHours: number;
  running: boolean;
  lastRun: string | null;
  nextRun: string | null;
  lastResult: SchedulerState["lastResult"];
  lastError: string | null;
  lastDigest: SchedulerState["lastDigest"];
}

export function schedulerStatus(): SchedulerStatus {
  const s = state();
  const cfg = getSchedule();
  return {
    enabled: cfg.enabled,
    intervalHours: cfg.intervalHours,
    running: s.running,
    lastRun: s.lastRun,
    nextRun: cfg.enabled ? s.nextRun : null,
    lastResult: s.lastResult,
    lastError: s.lastError,
    lastDigest: s.lastDigest,
  };
}
