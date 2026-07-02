import { runClaudeJson } from "./claude";

interface ReviewLite {
  author: string;
  rating: number | null;
  body: string;
  date: string;
}

function fmtReviews(reviews: ReviewLite[], cap = 80): string {
  return reviews
    .filter((r) => r.body && r.body.trim().length > 0)
    .slice(0, cap)
    .map((r, i) => `[${i + 1}] (${r.rating ?? "?"}★) ${r.body.replace(/\s+/g, " ").trim()}`)
    .join("\n");
}

export interface InsightsResult {
  mine: { praises: { theme: string; count: number; example: string }[]; complaints: { theme: string; count: number; example: string }[]; sentiment: { positive: number; neutral: number; negative: number } };
  competitors: { praises: { theme: string; count: number }[]; complaints: { theme: string; count: number }[]; sentiment: { positive: number; neutral: number; negative: number } };
  summary: string;
}

export async function generateInsights(
  myName: string,
  myReviews: ReviewLite[],
  competitorReviews: { name: string; reviews: ReviewLite[] }[]
): Promise<InsightsResult> {
  const compBlock = competitorReviews
    .map((c) => `### Competitor: ${c.name}\n${fmtReviews(c.reviews, 50)}`)
    .join("\n\n");

  const prompt = `You are a product analyst. Analyze Chrome extension reviews and produce a sentiment + theme breakdown.

MY EXTENSION: "${myName}"
My reviews:
${fmtReviews(myReviews)}

COMPETITOR REVIEWS (consolidated across all competitors):
${compBlock}

Return ONLY valid JSON (no prose, no markdown fences) matching exactly this shape:
{
  "mine": {
    "praises": [{"theme": "short label", "count": <int approx mentions>, "example": "short quote"}],
    "complaints": [{"theme": "short label", "count": <int>, "example": "short quote"}],
    "sentiment": {"positive": <0-100>, "neutral": <0-100>, "negative": <0-100>}
  },
  "competitors": {
    "praises": [{"theme": "short label", "count": <int>}],
    "complaints": [{"theme": "short label", "count": <int>}],
    "sentiment": {"positive": <0-100>, "neutral": <0-100>, "negative": <0-100>}
  },
  "summary": "2-3 sentence executive takeaway comparing us vs competitors"
}
Give 4-6 items per list, ordered by count desc. Sentiment percentages must sum to ~100.`;

  return runClaudeJson<InsightsResult>(prompt, { timeoutMs: 240_000 });
}

export interface PositioningResult {
  positioning_statement: string;
  pillars: { title: string; rationale: string; evidence: string[] }[];
  opportunities: { gap: string; competitor_pain: string; our_angle: string }[];
  messaging: string[];
}

export async function generatePositioning(
  myName: string,
  competitorReviews: { name: string; reviews: ReviewLite[] }[]
): Promise<PositioningResult> {
  // Focus on competitors' negative reviews (the complaints we can exploit).
  const compBlock = competitorReviews
    .map((c) => {
      const bad = c.reviews.filter((r) => (r.rating ?? 5) <= 3);
      return `### Competitor: ${c.name} (negative reviews)\n${fmtReviews(bad, 40)}`;
    })
    .join("\n\n");

  const prompt = `You are a product marketing strategist. Based on what users COMPLAIN about in competing Chrome extensions, derive a sharp positioning for our product "${myName}".

${compBlock}

Find the recurring pain points competitors fail to solve, and turn them into our positioning. Return ONLY valid JSON (no prose, no markdown fences):
{
  "positioning_statement": "one crisp sentence positioning '${myName}' against these gaps",
  "pillars": [{"title": "differentiator", "rationale": "why it matters", "evidence": ["competitor complaint this addresses"]}],
  "opportunities": [{"gap": "unmet need", "competitor_pain": "what users say", "our_angle": "how we win"}],
  "messaging": ["punchy marketing line 1", "line 2", "line 3"]
}
Give 3-5 pillars and 3-5 opportunities grounded in the actual complaints above.`;

  return runClaudeJson<PositioningResult>(prompt, { timeoutMs: 240_000 });
}

export interface ReplyResult {
  replies: { index: number; reply: string }[];
}

export async function generateReplies(
  myName: string,
  reviews: { body: string; rating: number | null; author: string }[]
): Promise<{ index: number; reply: string }[]> {
  const block = reviews
    .map(
      (r, i) =>
        `[${i}] author="${r.author}" rating=${r.rating ?? "?"}★\n${r.body.replace(/\s+/g, " ").trim()}`
    )
    .join("\n\n");

  const prompt = `You are the developer of the Chrome extension "${myName}" responding to user reviews. Write a warm, professional, specific public reply to EACH review below. Acknowledge concerns, thank praise, and where a complaint is raised, briefly note intent to address it. Keep each reply 1-3 sentences. Do not be generic — reference the review's actual content.

REVIEWS:
${block}

Return ONLY valid JSON (no prose, no markdown fences):
{"replies": [{"index": <review index>, "reply": "your reply text"}]}
Include one entry for every review index.`;

  const res = await runClaudeJson<ReplyResult>(prompt, { timeoutMs: 300_000 });
  return res.replies;
}

export interface RoadmapItem {
  title: string;
  type: "fix" | "feature" | "improvement";
  impact: "high" | "medium" | "low";
  effort: "small" | "medium" | "large";
  source: "our_complaints" | "competitor_gap" | "our_strength";
  rationale: string;
  evidence: string[];
}

export interface RoadmapResult {
  items: RoadmapItem[];
  summary: string;
}

export async function generateRoadmap(
  myName: string,
  myReviews: ReviewLite[],
  competitorReviews: { name: string; reviews: ReviewLite[] }[]
): Promise<RoadmapResult> {
  const myBad = myReviews.filter((r) => (r.rating ?? 5) <= 3);
  const myGood = myReviews.filter((r) => (r.rating ?? 0) >= 4);
  const compBad = competitorReviews
    .map((c) => `### ${c.name} — complaints\n${fmtReviews(c.reviews.filter((r) => (r.rating ?? 5) <= 3), 40)}`)
    .join("\n\n");

  const prompt = `You are a product manager for the Chrome extension "${myName}". Turn user feedback into a prioritized, buildable backlog.

OUR negative reviews (problems to FIX):
${fmtReviews(myBad, 50) || "(none)"}

OUR positive reviews (strengths to PROTECT / lean into):
${fmtReviews(myGood, 30) || "(none)"}

COMPETITORS' negative reviews (GAPS we can win by solving what they don't):
${compBad || "(none)"}

Produce a prioritized backlog. Each item must be concrete and buildable (not "improve UX"). Order items by priority (highest impact / lowest effort first). For each, ground it in the ACTUAL feedback above.

Return ONLY valid JSON (no prose, no markdown fences):
{
  "summary": "2-3 sentence strategic read of what to tackle first and why",
  "items": [
    {
      "title": "short imperative, e.g. 'Fix YouTube ad-blocking breakage'",
      "type": "fix" | "feature" | "improvement",
      "impact": "high" | "medium" | "low",
      "effort": "small" | "medium" | "large",
      "source": "our_complaints" | "competitor_gap" | "our_strength",
      "rationale": "one sentence: why this matters now",
      "evidence": ["short verbatim quote from a review above", "..."]
    }
  ]
}
Give 6-10 items, ordered best-first. Every item needs at least one evidence quote.`;

  return runClaudeJson<RoadmapResult>(prompt, { timeoutMs: 300_000 });
}

export interface PageIdea {
  page_query: string; // literal search phrase / suggested title
  keyword: string; // primary target keyword
  slug: string; // url slug, kebab-case
  hook: string; // the angle in one line
  recipe: {
    h1: string;
    intent_intro: string; // 1-2 sentence answer-first intro
    how_it_works: string[]; // exactly 3 steps
    faq: { q: string; a: string }[];
    cta: string;
    where_it_fits: string; // where on the site / funnel this page lives
  };
}

export interface PageIdeasResult {
  ideas: PageIdea[];
  grounded: boolean;
}

interface ExtForIdeas {
  name: string;
  category: string;
  description: string;
  users: string;
  rating: number | null;
}

export async function generatePageIdeas(
  ext: ExtForIdeas,
  insights: InsightsResult | null,
  sampleReviews: ReviewLite[]
): Promise<PageIdeasResult> {
  const grounded = !!insights;

  // Grounding block: prefer analyzed insights; otherwise fall back to
  // name + category + sample reviews.
  let groundingBlock: string;
  if (insights) {
    groundingBlock = `ANALYZED REVIEW DATA (use this to find real demand — what users praise and complain about):
Top praises: ${insights.mine.praises.map((p) => `${p.theme} (${p.count})`).join(", ")}
Top complaints: ${insights.mine.complaints.map((c) => `${c.theme} (${c.count})`).join(", ")}
Competitor complaints we can win on: ${insights.competitors.complaints.map((c) => c.theme).join(", ")}
Sentiment: ${insights.mine.sentiment.positive}% positive
Sample review quotes:
${fmtReviews(sampleReviews, 25)}`;
  } else {
    groundingBlock = `No analyzed insights yet — ground ideas in the extension's name, category, and these sample reviews:
${fmtReviews(sampleReviews, 25) || "(no reviews available — use name, category, and description)"}`;
  }

  const prompt = `You are an SEO/content strategist for a Chrome extension. Generate fresh, extension-specific landing/blog PAGE IDEAS that target real search demand and would attract users who'd install this extension.

EXTENSION
Name: ${ext.name}
Category: ${ext.category || "(unknown)"}
Users: ${ext.users || "n/a"} · Rating: ${ext.rating ?? "n/a"}
Store description:
${(ext.description || "(none)").slice(0, 2000)}

${groundingBlock}

Each idea must map to a realistic thing people SEARCH for, and be specific to THIS extension's strengths and the demand revealed above (not generic "how to use a Chrome extension" filler). Where review data shows a pain point or a loved feature, build pages around it.

Return ONLY valid JSON (no prose, no markdown fences):
{
  "ideas": [
    {
      "page_query": "the literal search phrase or page title someone would type/click",
      "keyword": "primary target keyword (2-5 words)",
      "slug": "kebab-case-url-slug",
      "hook": "one-line angle: why this page wins the click",
      "recipe": {
        "h1": "the page H1",
        "intent_intro": "1-2 sentence answer-first intro that satisfies the query immediately",
        "how_it_works": ["step 1", "step 2", "step 3"],
        "faq": [{"q": "common question", "a": "concise answer"}],
        "cta": "the call to action (install / try / compare)",
        "where_it_fits": "where this page lives in the site/funnel (e.g. landing, blog, comparison, use-case page)"
      }
    }
  ]
}
Give exactly 10 ideas. how_it_works must have exactly 3 steps. Include 2-3 FAQ entries each. Make page_query and keyword genuinely searchable.`;

  const res = await runClaudeJson<{ ideas: PageIdea[] }>(prompt, { timeoutMs: 300_000 });
  return { ideas: res.ideas, grounded };
}

export interface DirectoryKit {
  core: {
    product_name: string;
    website: string;
    chrome_web_store_url: string;
    category: string;
    pricing_model: string;
    platform: string;
    works_with: string;
  };
  taglines: { short: string; medium: string; long: string }; // <60 / <100 / <160 chars
  descriptions: {
    one_liner: string;
    short: string; // 50-80 words
    medium: string; // 100-150 words
    long: string; // 300+ words
  };
  feature_list: string[];
  pricing_table: { plan: string; price: string; notes: string }[];
  social_proof: string[];
  keywords: string[];
  problem_solution_pairs: { problem: string; solution: string }[];
  about_boilerplate: string;
}

export interface DirectoryKitMeta {
  name: string;
  category: string;
  chromeWebStoreUrl: string;
  rating: number | null;
  ratingCount: number | null;
  users: string;
  storeDescription: string;
}

export async function generateDirectoryKit(
  meta: DirectoryKitMeta,
  website: { url: string; title: string; metaDescription: string; text: string } | null
): Promise<DirectoryKit> {
  const siteBlock = website
    ? `PRODUCT WEBSITE (${website.url})
Title: ${website.title}
Meta: ${website.metaDescription}
Page content (landing + pricing):
${website.text.slice(0, 14_000)}`
    : `No product website provided — rely on the Chrome Web Store listing below.`;

  const prompt = `You are a launch/marketing copywriter. Produce a complete DIRECTORY SUBMISSION PLAYBOOK for this product — copy-paste-ready blocks for sites like Product Hunt, BetaList, SaaSHub, AlternativeTo, There's An AI For That, etc.

GROUND EVERYTHING IN THE FACTS BELOW. Use details only from the website and Chrome Web Store listing. If a fact is genuinely not present (e.g. founder name, "used at Harvard", exact user count, supported languages), insert a clearly bracketed placeholder like [FOUNDER NAME] or [USER COUNT] — DO NOT invent numbers, companies, or claims.

CHROME WEB STORE LISTING
Name: ${meta.name}
Store URL: ${meta.chromeWebStoreUrl}
Category: ${meta.category || "[CATEGORY]"}
Rating: ${meta.rating ?? "[RATING]"} stars across ${meta.ratingCount ?? "[N]"} ratings
Users: ${meta.users || "[USER COUNT]"}
Store description:
${(meta.storeDescription || "(none)").slice(0, 3000)}

${siteBlock}

Respect the stated character/word limits exactly. Return ONLY valid JSON (no prose, no markdown fences):
{
  "core": {
    "product_name": "",
    "website": "${website?.url || ""}",
    "chrome_web_store_url": "${meta.chromeWebStoreUrl}",
    "category": "",
    "pricing_model": "e.g. Freemium (Free + Pro $X/mo ...)",
    "platform": "",
    "works_with": "comma-separated integrations from the site"
  },
  "taglines": { "short": "UNDER 60 chars", "medium": "UNDER 100 chars", "long": "UNDER 160 chars" },
  "descriptions": {
    "one_liner": "one sentence",
    "short": "50-80 words",
    "medium": "100-150 words",
    "long": "300+ words, multi-paragraph"
  },
  "feature_list": ["checkbox-style feature", "..."],
  "pricing_table": [{"plan": "", "price": "", "notes": ""}],
  "social_proof": ["stat or proof point from the site, with [placeholders] if a number isn't stated"],
  "keywords": ["seo tag", "..."],
  "problem_solution_pairs": [{"problem": "", "solution": ""}],
  "about_boilerplate": "1 paragraph 'About' suitable for directories"
}
Give 8-15 features, 3-6 pricing rows (only if pricing is on the site, else a single row with placeholders), 4-8 social proof points, 15-25 keywords, and 3-5 problem/solution pairs.`;

  return runClaudeJson<DirectoryKit>(prompt, { timeoutMs: 300_000 });
}
