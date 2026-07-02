/**
 * Next.js startup hook — runs once when the server boots.
 * Starts the background re-scrape scheduler (Node runtime only, since it uses
 * native modules: better-sqlite3 + playwright). No-op when the schedule is
 * disabled in settings; reloadScheduler() reads config and sets up the timer.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reloadScheduler } = await import("./lib/scheduler");
    try {
      reloadScheduler();
    } catch {
      // DB/settings may not be ready in some build phases — safe to ignore.
    }
  }
}
