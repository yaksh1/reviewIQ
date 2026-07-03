import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, createSessionToken, SESSION_COOKIE, sessionCookieOptions, SESSION_MAX_AGE_SEC } from "@/lib/auth";
import { authRequired } from "@/lib/auth";

export const runtime = "nodejs";

/** POST { email, password } → set a session cookie on success. */
export async function POST(req: NextRequest) {
  if (!authRequired()) {
    return NextResponse.json({ error: "Auth is not enabled on this instance." }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  const sub = verifyCredentials(email, password);
  if (!sub) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, email: sub });
  res.cookies.set(SESSION_COOKIE, createSessionToken(sub), sessionCookieOptions(SESSION_MAX_AGE_SEC));
  return res;
}
