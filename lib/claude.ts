import { runLLM, resolveProvider, type ProviderConfig } from "./providers";

export interface RunOpts {
  timeoutMs?: number;
  /** BYOK: per-request provider. If omitted, falls back to env, then `claude -p`. */
  provider?: ProviderConfig | null;
}

/**
 * Run the active LLM provider and return raw text.
 * Provider resolution: explicit BYOK config → env key → local `claude -p`.
 * The name is kept for backward-compat with existing call sites.
 */
export function runClaude(prompt: string, opts: RunOpts = {}): Promise<string> {
  const cfg = resolveProvider(opts.provider);
  return runLLM(cfg, prompt, { timeoutMs: opts.timeoutMs });
}

/** Extract the first balanced JSON object/array from a possibly chatty reply. */
export function extractJson<T = unknown>(text: string): T {
  // Strip ```json fences if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in claude output:\n" + text);

  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1);
        return JSON.parse(slice) as T;
      }
    }
  }
  throw new Error("Unbalanced JSON in claude output:\n" + text);
}

/** Run the active provider and parse JSON out of its reply. */
export async function runClaudeJson<T = unknown>(
  prompt: string,
  opts?: RunOpts
): Promise<T> {
  const text = await runClaude(prompt, opts);
  return extractJson<T>(text);
}
