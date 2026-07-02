import { NextRequest, NextResponse } from "next/server";
import {
  getProviderSettingsView,
  getStoredProviderConfig,
  saveProviderSettings,
} from "@/lib/settings";
import {
  PROVIDER_PRESETS,
  resolveProvider,
  runLLM,
  type ProviderConfig,
  type ProviderKind,
} from "@/lib/providers";

export const runtime = "nodejs";

const VALID_KINDS: ProviderKind[] = ["claude-cli", "anthropic", "openai-compatible"];

/** GET → presets + current (masked) settings + which provider is actually active. */
export async function GET() {
  const active = resolveProvider();
  return NextResponse.json({
    presets: PROVIDER_PRESETS,
    settings: getProviderSettingsView(),
    active: { kind: active.kind, model: active.model || "", baseURL: active.baseURL || "" },
    // Whether env keys are present (so the UI can explain the fallback chain).
    env: {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    },
  });
}

/** POST → save settings, or run a connectivity test. Body: { action?: "save"|"test", ... } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action === "test" ? "test" : "save";

  const kind = body.kind as ProviderKind;
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Invalid provider kind." }, { status: 400 });
  }

  if (action === "save") {
    saveProviderSettings({
      kind,
      // apiKey: undefined keeps the existing key; "" clears it; a string sets it.
      apiKey: body.apiKey,
      baseURL: body.baseURL,
      model: body.model,
    });
    return NextResponse.json({ ok: true, settings: getProviderSettingsView() });
  }

  // action === "test": build a config from the request, but if no key was typed
  // and one is already stored, reuse the stored key so "Test" works on edit.
  let apiKey: string | undefined = body.apiKey;
  if (kind !== "claude-cli" && !apiKey) {
    apiKey = getStoredProviderConfig()?.apiKey || undefined;
  }
  const cfg: ProviderConfig = {
    kind,
    apiKey,
    baseURL: body.baseURL || undefined,
    model: body.model || undefined,
  };

  try {
    const out = await runLLM(cfg, 'Reply with exactly: OK', { timeoutMs: 30_000 });
    return NextResponse.json({ ok: true, sample: out.slice(0, 200) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 200 }
    );
  }
}
