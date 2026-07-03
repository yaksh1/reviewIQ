import { getDigestConfig } from "./settings";
import { buildAllDigests, renderDigestText, renderDigestMarkdown, type ProjectDigest } from "./digest";

/*
  Digest delivery. Two channels, both dependency-free (raw fetch):
   - "webhook": POST to a Slack/Discord/generic incoming webhook. Sends a
     Slack-style `{ text }` payload (Discord accepts `content`, so we send both).
   - "email": Resend HTTPS API (https://api.resend.com/emails) — a plain POST
     with an API key, no SDK.

  Delivery is opt-in and config-driven (lib/settings digest_config). Nothing is
  sent unless the channel is configured, so self-host stays silent by default.
*/

export interface DeliveryResult {
  ok: boolean;
  channel: string;
  sent: number; // projects included
  skipped: boolean; // true if nothing changed and onlyWhenChanged
  error?: string;
}

/** POST a digest body to a Slack/Discord/generic incoming webhook. */
async function sendWebhook(url: string, text: string): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // `text` for Slack, `content` for Discord — harmless extra key for each.
    body: JSON.stringify({ text, content: text }),
  });
  if (!res.ok) {
    throw new Error(`Webhook ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
}

/** Send an email via the Resend HTTPS API (no SDK). */
async function sendResendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  text: string
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
}

/** Combine per-project digests into one message body. */
function combineText(digests: ProjectDigest[]): string {
  return digests.map(renderDigestText).join("\n\n———\n\n");
}
function combineMarkdown(digests: ProjectDigest[]): string {
  return digests.map(renderDigestMarkdown).join("\n\n---\n\n");
}

/**
 * Build digests for all projects and deliver them via the configured channel.
 * Returns a result summary; never throws for "not configured" (returns ok:false).
 */
export async function deliverDigests(): Promise<DeliveryResult> {
  const cfg = getDigestConfig();
  if (!cfg.enabled || cfg.channel === "none") {
    return { ok: false, channel: cfg.channel, sent: 0, skipped: true, error: "Digest delivery not enabled." };
  }

  const digests = buildAllDigests();
  const anyChanged = digests.some((d) => d.hasChanges);
  if (cfg.onlyWhenChanged && !anyChanged) {
    return { ok: true, channel: cfg.channel, sent: 0, skipped: true };
  }

  // When onlyWhenChanged, include just the projects that moved.
  const included = cfg.onlyWhenChanged ? digests.filter((d) => d.hasChanges) : digests;
  if (included.length === 0) {
    return { ok: true, channel: cfg.channel, sent: 0, skipped: true };
  }

  try {
    if (cfg.channel === "webhook") {
      if (!cfg.webhookUrl) throw new Error("No webhook URL configured.");
      await sendWebhook(cfg.webhookUrl, combineMarkdown(included));
    } else if (cfg.channel === "email") {
      if (!cfg.emailApiKey || !cfg.emailFrom || !cfg.emailTo) {
        throw new Error("Email channel needs an API key, from, and to address.");
      }
      const subject = `ReviewIQ digest — ${included.length} project${included.length === 1 ? "" : "s"} updated`;
      await sendResendEmail(cfg.emailApiKey, cfg.emailFrom, cfg.emailTo, subject, combineText(included));
    }
    return { ok: true, channel: cfg.channel, sent: included.length, skipped: false };
  } catch (e) {
    return {
      ok: false,
      channel: cfg.channel,
      sent: 0,
      skipped: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
