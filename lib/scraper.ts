import { chromium, type Browser } from "playwright";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface ScrapedReview {
  review_uid: string;
  author: string;
  rating: number | null;
  body: string;
  date: string;
}

export interface ExtensionMeta {
  name: string;
  slug: string;
  icon: string;
  rating: number | null;
  rating_count: number | null;
  users: string;
  description: string;
  category: string;
}

export interface ScrapeResult {
  meta: ExtensionMeta;
  reviews: ScrapedReview[];
}

let browserPromise: Promise<Browser> | null = null;
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    // --no-sandbox is required when running as root inside a container.
    browserPromise = chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    // If the browser dies (crash/OOM), clear the singleton so the next
    // scrape relaunches instead of reusing a dead handle.
    browserPromise.then((b) => b.on("disconnected", () => { browserPromise = null; })).catch(() => { browserPromise = null; });
  }
  return browserPromise;
}

function parseCount(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/([\d.]+)\s*([KkMm])?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (/k/i.test(m[2] || "")) n *= 1_000;
  if (/m/i.test(m[2] || "")) n *= 1_000_000;
  return Math.round(n);
}

/**
 * Parse a Chrome Web Store review date string into a Date.
 * Handles absolute ("Sep 5, 2025") and relative ("2 days ago", "yesterday",
 * "last week", "a month ago"). Returns null if unparseable.
 * `now` is injected so callers control "today".
 */
export function parseReviewDate(raw: string, now: Date): Date | null {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return null;

  if (s === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (s === "today" || s === "just now") return new Date(now);

  // "2 days ago", "a month ago", "last week", "3 weeks ago"
  const rel = s.match(/(?:(\d+)|a|an|last)\s*(second|minute|hour|day|week|month|year)/);
  if (rel) {
    const qty = rel[1] ? parseInt(rel[1], 10) : 1;
    const unit = rel[2];
    const d = new Date(now);
    if (unit === "second") d.setSeconds(d.getSeconds() - qty);
    else if (unit === "minute") d.setMinutes(d.getMinutes() - qty);
    else if (unit === "hour") d.setHours(d.getHours() - qty);
    else if (unit === "day") d.setDate(d.getDate() - qty);
    else if (unit === "week") d.setDate(d.getDate() - qty * 7);
    else if (unit === "month") d.setMonth(d.getMonth() - qty);
    else if (unit === "year") d.setFullYear(d.getFullYear() - qty);
    return d;
  }

  // Absolute, e.g. "Sep 5, 2025" or "September 5, 2025".
  const abs = new Date(raw);
  return isNaN(abs.getTime()) ? null : abs;
}

export interface ScrapeOptions {
  /** Stop loading once reviews are older than this date. Reviews are newest-first. */
  cutoffDate?: Date;
  /** Hard ceiling so we never spin forever on huge extensions. */
  maxReviews?: number;
  /** "now" for relative-date parsing; injected for testability. */
  now?: Date;
  onProgress?: (msg: string) => void;
}

/**
 * Scrape an extension's metadata and reviews from the Chrome Web Store.
 * Navigates to the /reviews route and clicks "Load more" until either:
 *  - a loaded review is older than `cutoffDate` (the primary stop), or
 *  - `maxReviews` is reached (safety ceiling), or
 *  - the button disappears / stops yielding new reviews.
 * Reviews older than the cutoff are filtered out of the result.
 */
export async function scrapeExtension(
  extId: string,
  opts: ScrapeOptions = {}
): Promise<ScrapeResult> {
  const cutoffDate = opts.cutoffDate ?? null;
  const maxReviews = opts.maxReviews ?? 1000;
  const now = opts.now ?? new Date();
  const onProgress = opts.onProgress;
  const browser = await getBrowser();
  const ctx = await browser.newContext({ userAgent: UA, locale: "en-US" });
  const page = await ctx.newPage();
  try {
    // Resolve canonical slug URL via redirect.
    await page.goto(`https://chromewebstore.google.com/detail/${extId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(1800);

    const baseUrl = page.url().replace(/\/+$/, "");
    const slugMatch = baseUrl.match(/\/detail\/([^/]+)\//);
    const slug = slugMatch ? slugMatch[1] : "";

    // Metadata from detail page.
    const meta = await page.evaluate(() => {
      const name =
        document.querySelector("h1")?.textContent?.trim() || "";
      const icon =
        (document.querySelector('img[alt*="icon" i]') as HTMLImageElement)
          ?.src ||
        (document.querySelector("h1")?.previousElementSibling?.querySelector(
          "img"
        ) as HTMLImageElement)?.src ||
        (document.querySelector('img[src*="lh3.googleusercontent"]') as HTMLImageElement)?.src ||
        "";
      const ratingEl = document.querySelector('[aria-label*="out of 5 stars" i]');
      const ratingLabel = ratingEl?.getAttribute("aria-label") || "";
      const bodyText = document.body.innerText;
      const usersMatch = bodyText.match(/([\d,]+)\s+users/i);
      const ratingsMatch = bodyText.match(/([\d.,]+[KM]?)\s+ratings/i);

      // Short tagline from meta; long copy from the biggest paragraph block.
      const shortDesc =
        document.querySelector('meta[name="description"]')?.getAttribute("content") ||
        document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
        "";
      const longDesc = Array.from(document.querySelectorAll("p"))
        .map((p) => (p.textContent || "").trim())
        .filter((t) => t.length > 80)
        .sort((a, b) => b.length - a.length)[0] || "";
      const description = [shortDesc, longDesc]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 4000);

      // Category: links into /category/...; skip the generic "Extension" root.
      const catLinks = Array.from(document.querySelectorAll('a[href*="/category/"]'))
        .map((a) => (a.textContent || "").trim())
        .filter((t) => t && !/^extensions?$/i.test(t));
      const category = catLinks[catLinks.length - 1] || "";

      return {
        name,
        icon,
        ratingLabel,
        users: usersMatch ? usersMatch[1] : "",
        ratingsText: ratingsMatch ? ratingsMatch[1] : "",
        description,
        category,
      };
    });

    const ratingNum = (() => {
      const m = meta.ratingLabel.match(/([\d.]+)\s+out of 5/i);
      return m ? parseFloat(m[1]) : null;
    })();

    onProgress?.(`Loading reviews for ${meta.name || extId}…`);

    // Go to reviews page.
    await page.goto(baseUrl + "/reviews", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(2500);

    // Reviews are listed newest-first. Keep clicking "Load more" until the
    // OLDEST loaded review predates the cutoff, or we hit the safety ceiling,
    // or the button stops yielding new reviews.
    const lastDateText = async (): Promise<string> => {
      const dates = await page.locator(".T7rvce .ydlbEf").allTextContents();
      return dates.length ? dates[dates.length - 1].trim() : "";
    };
    const reachedCutoff = async (): Promise<boolean> => {
      if (!cutoffDate) return false;
      const d = parseReviewDate(await lastDateText(), now);
      return d ? d < cutoffDate : false;
    };

    let stagnant = 0;
    while (true) {
      const count = await page.locator(".T7rvce").count();
      if (count >= maxReviews) break;
      if (await reachedCutoff()) break;
      const loadMore = page.getByRole("button", { name: /load more/i });
      if (!(await loadMore.count())) break;
      const isVisible = await loadMore.first().isVisible().catch(() => false);
      if (!isVisible) break;
      await loadMore.first().scrollIntoViewIfNeeded().catch(() => {});
      await loadMore.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1400);
      const newCount = await page.locator(".T7rvce").count();
      if (newCount === count) {
        stagnant++;
        if (stagnant >= 2) break;
      } else {
        stagnant = 0;
        onProgress?.(`Fetched ${newCount} reviews…`);
      }
    }

    const reviews: ScrapedReview[] = await page.evaluate(() => {
      const out: { review_uid: string; author: string; rating: number | null; body: string; date: string }[] = [];
      const cards = Array.from(document.querySelectorAll(".T7rvce"));
      for (const card of cards) {
        const header = card.querySelector(".U47jjf");
        const author =
          header?.querySelector(".LfYwpe")?.textContent?.trim() || "";
        const ratingLabel =
          header
            ?.querySelector("[aria-label*='out of 5 stars']")
            ?.getAttribute("aria-label") || "";
        const rm = ratingLabel.match(/([\d.]+)\s+out of 5/i);
        const rating = rm ? Math.round(parseFloat(rm[1])) : null;
        const date =
          header?.querySelector(".ydlbEf")?.textContent?.trim() || "";
        const body =
          card.querySelector(".fzDEpf")?.textContent?.trim() || "";
        const uid = (header?.id || `${author}|${date}|${body.slice(0, 24)}`).trim();
        if (!author && !body) continue;
        out.push({ review_uid: uid, author, rating, body, date });
      }
      return out;
    });

    // Drop reviews older than the cutoff (keep ones we can't date — rare).
    const filtered = cutoffDate
      ? reviews.filter((r) => {
          const d = parseReviewDate(r.date, now);
          return d ? d >= cutoffDate : true;
        })
      : reviews;

    return {
      meta: {
        name: meta.name,
        slug,
        icon: meta.icon,
        rating: ratingNum,
        rating_count: parseCount(meta.ratingsText),
        users: meta.users,
        description: meta.description,
        category: meta.category,
      },
      reviews: filtered.slice(0, maxReviews),
    };
  } finally {
    await ctx.close();
  }
}

export interface WebsiteScrape {
  url: string;
  title: string;
  metaDescription: string;
  text: string; // cleaned visible text from landing + pricing pages
  pricingFound: boolean;
}

/** Pull readable text + meta from a single rendered page. */
async function readPageText(
  ctx: import("playwright").BrowserContext,
  url: string
): Promise<{ title: string; metaDescription: string; text: string }> {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1500);
    return await page.evaluate(() => {
      const title = document.title || "";
      const metaDescription =
        document.querySelector('meta[name="description"]')?.getAttribute("content") ||
        document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
        "";
      // Strip script/style/nav noise, then collapse whitespace.
      document.querySelectorAll("script,style,noscript,svg").forEach((n) => n.remove());
      const raw = (document.body?.innerText || "").replace(/\n{3,}/g, "\n\n");
      return { title, metaDescription, text: raw };
    });
  } finally {
    await page.close();
  }
}

/**
 * Scrape a product website: the given URL plus a linked "pricing" page if one
 * is discoverable. Returns concatenated cleaned text for AI grounding.
 */
export async function scrapeWebsite(inputUrl: string): Promise<WebsiteScrape> {
  let url = inputUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const browser = await getBrowser();
  const ctx = await browser.newContext({ userAgent: UA, locale: "en-US" });
  try {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1500);

    const landing = await page.evaluate(() => {
      const title = document.title || "";
      const metaDescription =
        document.querySelector('meta[name="description"]')?.getAttribute("content") ||
        document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
        "";
      // Find a pricing link before we strip the DOM.
      const origin = location.origin;
      const links = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
      const priceLink =
        links.find((a) => /pricing|\/plans?\b|\/price/i.test(a.href) || /pricing|plans/i.test(a.textContent || ""))?.href || "";
      document.querySelectorAll("script,style,noscript,svg").forEach((n) => n.remove());
      const text = (document.body?.innerText || "").replace(/\n{3,}/g, "\n\n");
      return { title, metaDescription, text, priceLink, origin };
    });
    await page.close();

    let pricingFound = false;
    let pricingText = "";
    if (
      landing.priceLink &&
      landing.priceLink !== url &&
      landing.priceLink.startsWith(landing.origin)
    ) {
      try {
        const p = await readPageText(ctx, landing.priceLink);
        pricingText = p.text;
        pricingFound = true;
      } catch {
        /* ignore pricing fetch failures */
      }
    }

    const text = [
      landing.text.slice(0, 12_000),
      pricingFound ? `\n\n===== PRICING PAGE =====\n${pricingText.slice(0, 6_000)}` : "",
    ].join("");

    return {
      url,
      title: landing.title,
      metaDescription: landing.metaDescription,
      text,
      pricingFound,
    };
  } finally {
    await ctx.close();
  }
}
