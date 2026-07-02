import crypto from "crypto";

/*
  Mint a Google API access token from a service-account JSON key — no SDK, just
  Node crypto + fetch (matches the project's no-dependency style).

  Flow (OAuth 2.0 service account / "two-legged" JWT):
   1. Build a JWT { iss: client_email, scope, aud: token_uri, iat, exp }.
   2. Sign it RS256 with the service account's private_key.
   3. POST it to the token endpoint → { access_token, expires_in }.

  Tokens are cached in-memory per service-account+scope until ~1 min before expiry.
*/

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface CachedToken {
  token: string;
  exp: number; // epoch seconds
}

const tokenCache = new Map<string, CachedToken>();

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Validate that a parsed object looks like a usable service-account key. */
export function isServiceAccount(obj: unknown): obj is ServiceAccount {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.client_email === "string" &&
    typeof o.private_key === "string" &&
    o.private_key.includes("BEGIN PRIVATE KEY")
  );
}

/** Get a cached or fresh access token for the given service account + scope. */
export async function getAccessToken(
  sa: ServiceAccount,
  scope = "https://www.googleapis.com/auth/analytics.readonly"
): Promise<string> {
  const cacheKey = `${sa.client_email}|${scope}`;
  const now = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.exp - 60 > now) return cached.token;

  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = base64url(signer.sign(sa.private_key));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(cacheKey, { token: data.access_token, exp: now + (data.expires_in || 3600) });
  return data.access_token;
}
