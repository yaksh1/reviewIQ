import { NextResponse } from "next/server";
import { getSession, authRequired } from "@/lib/auth";

export const runtime = "nodejs";

/** GET → current auth state (whether auth is required + who's logged in). */
export async function GET() {
  const required = authRequired();
  const session = required ? await getSession() : null;
  return NextResponse.json({
    authRequired: required,
    authenticated: !required || !!session,
    email: session?.sub ?? null,
  });
}
