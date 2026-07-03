import { cookies } from "next/headers";
import crypto from "crypto";
import { encryptSecret, decryptSecret } from "./crypto";
import { isHosted } from "./hosting";

/*
  Authentication — hosted tier only.

  Self-host (default) is single-tenant and unauthenticated: one operator, one
  box, no login. That stays exactly as it is. On the HOSTED deploy we gate the
  app behind a login so the managed multi-user service isn't wide open.

  This PR implements the session mechanism + a single-admin credential check
  (env-configured), which is enough to protect the hosted instance today. True
  multi-tenant, per-user data isolation lands with the Postgres adapter (the
  storage seam from the previous PR); this is the auth layer it will build on.

  Session: an AES-GCM-encrypted cookie (via lib/crypto, keyed by APP_SECRET).
  Encryption gives us tamper-evidence (auth tag) for free, so a forged/edited
  cookie fails to decrypt and is rejected.

  Known limitations (acceptable for the single-admin hosted MVP; revisit with
  real multi-user accounts on the Postgres adapter):
   - Stateless tokens: no server-side session store, so a leaked token can't be
     revoked before its 30-day TTL, and logout only clears the current client.
     Rotating APP_SECRET invalidates ALL sessions (the blunt revocation lever).
   - No login rate-limiting here; put the hosted deploy behind a WAF / rate limit
     (e.g. the platform's) to blunt password brute-force.
*/

const COOKIE = "riq_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface Session {
  sub: string; // subject — the logged-in identity (email/username)
  iat: number; // issued-at (epoch ms)
}

/** Whether auth is enforced. Only on the hosted tier. */
export function authRequired(): boolean {
  return isHosted();
}

/**
 * Verify a username/password against the hosted admin credentials.
 * Configured via env: AUTH_ADMIN_EMAIL + AUTH_ADMIN_PASSWORD. Returns the
 * subject on success, or null. (A future PR swaps this for real user records
 * once the Postgres adapter exists.)
 */
export function verifyCredentials(email: string, password: string): string | null {
  const adminEmail = process.env.AUTH_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return null; // fail closed when unconfigured

  const emailMatch = email.trim().toLowerCase() === adminEmail.toLowerCase();
  // Constant-time password compare (hash both sides to equalize length so
  // timingSafeEqual doesn't throw and length isn't leaked).
  const passMatch = timingSafeEqualStr(password, adminPassword);
  return emailMatch && passMatch ? adminEmail : null;
}

/** Length-independent constant-time string comparison. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/*
  Cookie-safe wrapping: encryptSecret() emits standard base64 (contains + / =),
  which can be mangled when round-tripped through a cookie. We base64url-encode
  the whole token for the cookie value so it's transmitted intact.
*/
function toCookieSafe(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
function fromCookieSafe(s: string): string {
  try {
    return Buffer.from(s, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

/** Serialize + encrypt a session into a cookie-safe value. */
export function createSessionToken(sub: string): string {
  const session: Session = { sub, iat: Date.now() };
  return toCookieSafe(encryptSecret(JSON.stringify(session)));
}

/** Decrypt + validate a session token. Returns null if invalid or expired. */
export function parseSessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const inner = fromCookieSafe(token);
  if (!inner) return null;
  const json = decryptSecret(inner);
  if (!json) return null; // tampered / wrong key
  try {
    const s = JSON.parse(json) as Session;
    if (!s.sub || !s.iat) return null;
    if (Date.now() - s.iat > SESSION_TTL_MS) return null; // expired
    return s;
  } catch {
    return null;
  }
}

/**
 * Read the current session from the request cookies (server components / routes).
 *
 * Note: the primary auth enforcement is the proxy (proxy.ts), which runs on the
 * Node runtime in Next 16 and cryptographically validates the cookie on EVERY
 * non-public request before any route runs. So routes don't each re-check; this
 * is for reading WHO is logged in (e.g. the /api/auth/session status route).
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return parseSessionToken(store.get(COOKIE)?.value);
}

/** The cookie name + options used when setting/clearing the session. */
export const SESSION_COOKIE = COOKIE;
export function sessionCookieOptions(maxAgeSec?: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    ...(maxAgeSec !== undefined ? { maxAge: maxAgeSec } : {}),
  };
}
export const SESSION_MAX_AGE_SEC = Math.floor(SESSION_TTL_MS / 1000);
