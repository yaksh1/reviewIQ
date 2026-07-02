import { spawn } from "child_process";
import { getStoredProviderConfig } from "./settings";
import { isHosted } from "./hosting";

/*
  Multi-provider LLM layer for BYOK (bring-your-own-key).

  Three transport kinds cover everything:
   - "claude-cli"        → local `claude -p` (self-host; uses the user's Claude
                           subscription on their own machine; no key needed)
   - "anthropic"         → Anthropic Messages API (api.anthropic.com)
   - "openai-compatible" → POST {baseURL}/chat/completions — covers OpenAI,
                           Fireworks, Moonshot (Kimi), GLM (Zhipu), MiniMax,
                           Together, Groq, OpenRouter, Ollama, and most others.

  All providers resolve behind runLLM(), so analysis call sites never change.
*/

export type ProviderKind = "claude-cli" | "anthropic" | "openai-compatible";

export interface ProviderConfig {
  kind: ProviderKind;
  apiKey?: string; // omitted for claude-cli
  baseURL?: string; // for openai-compatible
  model?: string; // model id; defaults per provider
}

/** A user-facing preset so the settings UI can show a dropdown. */
export interface ProviderPreset {
  id: string;
  label: string;
  kind: ProviderKind;
  baseURL?: string;
  defaultModel?: string;
  models?: string[]; // suggested models (free text also allowed)
  keyHint?: string; // where to get the key
  needsKey: boolean;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "claude-cli",
    label: "Local Claude CLI (self-host — uses your Claude subscription)",
    kind: "claude-cli",
    needsKey: false,
    keyHint: "Runs `claude -p` on this machine. No key needed.",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude API)",
    kind: "anthropic",
    defaultModel: "claude-sonnet-4-6",
    models: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    keyHint: "console.anthropic.com → API Keys (sk-ant-...)",
    needsKey: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai-compatible",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    keyHint: "platform.openai.com → API Keys (sk-...)",
    needsKey: true,
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    kind: "openai-compatible",
    baseURL: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/kimi-k2-instruct",
    keyHint: "fireworks.ai → API Keys",
    needsKey: true,
  },
  {
    id: "moonshot",
    label: "Moonshot (Kimi)",
    kind: "openai-compatible",
    baseURL: "https://api.moonshot.ai/v1",
    defaultModel: "kimi-k2-0905-preview",
    keyHint: "platform.moonshot.ai → API Keys",
    needsKey: true,
  },
  {
    id: "zhipu",
    label: "GLM (Zhipu AI)",
    kind: "openai-compatible",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4.6",
    keyHint: "open.bigmodel.cn → API Keys",
    needsKey: true,
  },
  {
    id: "minimax",
    label: "MiniMax",
    kind: "openai-compatible",
    baseURL: "https://api.minimax.io/v1",
    defaultModel: "MiniMax-Text-01",
    keyHint: "minimax.io → API Keys",
    needsKey: true,
  },
  {
    id: "together",
    label: "Together AI",
    kind: "openai-compatible",
    baseURL: "https://api.together.xyz/v1",
    defaultModel: "moonshotai/Kimi-K2-Instruct",
    keyHint: "together.ai → API Keys",
    needsKey: true,
  },
  {
    id: "groq",
    label: "Groq",
    kind: "openai-compatible",
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    keyHint: "console.groq.com → API Keys",
    needsKey: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter (any model)",
    kind: "openai-compatible",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-sonnet-4-6",
    keyHint: "openrouter.ai → Keys",
    needsKey: true,
  },
  {
    id: "ollama",
    label: "Ollama (local, no key)",
    kind: "openai-compatible",
    baseURL: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
    keyHint: "Runs against a local Ollama server.",
    needsKey: false,
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible endpoint",
    kind: "openai-compatible",
    keyHint: "Any endpoint exposing /chat/completions.",
    needsKey: true,
  },
];

const SYSTEM_PROMPT =
  "You are a precise analyst. When asked for JSON, output ONLY valid JSON with no prose and no markdown code fences.";

/** ---- transport: local claude -p ---- */
function runClaudeCli(prompt: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p"], {
      shell: process.platform === "win32",
      windowsHide: true,
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`claude timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`claude exited ${code}: ${err || out}`));
      else resolve(out.trim());
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/** ---- transport: Anthropic Messages API ---- */
async function runAnthropic(cfg: ProviderConfig, prompt: string, timeoutMs: number): Promise<string> {
  const model = cfg.model || "claude-sonnet-4-6";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { content?: { text?: string }[] };
    return (data.content?.map((b) => b.text ?? "").join("") || "").trim();
  } finally {
    clearTimeout(t);
  }
}

/** ---- transport: OpenAI-compatible /chat/completions ---- */
async function runOpenAICompatible(cfg: ProviderConfig, prompt: string, timeoutMs: number): Promise<string> {
  const baseURL = (cfg.baseURL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = cfg.model || "gpt-4o";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Provider ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || "").trim();
  } finally {
    clearTimeout(t);
  }
}

/** Unified entry point. Dispatches on provider kind. */
export async function runLLM(
  cfg: ProviderConfig,
  prompt: string,
  opts: { timeoutMs?: number } = {}
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 240_000;
  switch (cfg.kind) {
    case "claude-cli":
      return runClaudeCli(prompt, timeoutMs);
    case "anthropic":
      return runAnthropic(cfg, prompt, timeoutMs);
    case "openai-compatible":
      return runOpenAICompatible(cfg, prompt, timeoutMs);
    default:
      throw new Error(`Unknown provider kind: ${(cfg as ProviderConfig).kind}`);
  }
}

/** Provider config from env keys, or null if none set. */
function envProvider(): ProviderConfig | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return { kind: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.LLM_MODEL };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      kind: "openai-compatible",
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
      model: process.env.LLM_MODEL,
    };
  }
  return null;
}

/**
 * Resolve the active provider config.
 *
 * Self-host order: explicit per-request cfg (BYOK) → DB settings → env → claude-cli.
 * Hosted order:    env (the host's managed key) → explicit BYOK → DB settings.
 *   On the hosted tier `claude -p` is never used — it's a self-host/subscription
 *   path and proxying it for customers isn't allowed — so hosted requires an env
 *   API key and never falls back to the CLI.
 */
export function resolveProvider(explicit?: ProviderConfig | null): ProviderConfig {
  if (isHosted()) {
    const env = envProvider();
    if (env) return env;
    if (explicit && explicit.kind && explicit.kind !== "claude-cli") return explicit;
    try {
      const stored = getStoredProviderConfig();
      if (stored && stored.kind && stored.kind !== "claude-cli") return stored;
    } catch {
      /* db unavailable */
    }
    throw new Error(
      "Hosted mode requires an API key (set ANTHROPIC_API_KEY or OPENAI_API_KEY). The claude CLI is not available on the hosted tier."
    );
  }

  // --- self-host ---
  if (explicit && explicit.kind) return explicit;

  // DB-backed settings saved via the Settings UI (single-tenant).
  // lib/settings imports only *types* from this module, so no runtime cycle.
  try {
    const stored = getStoredProviderConfig();
    if (stored && stored.kind) return stored;
  } catch {
    // settings/db unavailable (e.g. build-time) — fall through to env / cli
  }

  const env = envProvider();
  if (env) return env;

  return { kind: "claude-cli" };
}
