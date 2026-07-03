import { NextRequest, NextResponse } from "next/server";
import { parseSessionToken } from "@/lib/auth";

/*
  Auth gate — hosted tier only. (Next 16 "proxy" convention, formerly middleware.)

  In Next 16 the proxy runs on the NODE runtime (not edge), so it can do REAL
  cryptographic validation of the session cookie here — not just a presence
  check. This is the single choke point that protects every route, so a forged
  or tampered cookie is rejected before any handler runs.

  Self-host (HOSTED unset): complete no-op. Single-tenant, no login.
*/

// Paths reachable without a session. Matched by whole path segments (so "/p"
// does NOT match "/projects" — a subtle auth-bypass otherwise).
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth", // login / logout / session status
  "/p", // the public build-in-public pages are meant to be public
  "/api/public", // public page data
];

/** True if `pathname` equals a prefix or is a path-segment child of it. */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(req: NextRequest) {
  // Only enforce on the hosted deployment.
  if (process.env.HOSTED !== "true" && process.env.HOSTED !== "1") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Cryptographically validate the session (decrypt + expiry check). A garbage
  // or tampered cookie yields null and is rejected.
  const token = req.cookies.get("riq_session")?.value;
  const session = parseSessionToken(token);
  if (session) return NextResponse.next();

  // Not authenticated. API → 401; page navigation → redirect to /login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

// Skip static assets + Next internals.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
