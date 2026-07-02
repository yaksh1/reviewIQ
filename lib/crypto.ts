import crypto from "crypto";
import path from "path";
import fs from "fs";

/*
  Symmetric encryption for secrets at rest (BYOK API keys in SQLite).

  Key material comes from APP_SECRET. If unset, we generate a random secret
  once and persist it next to the DB (DATA_DIR/.app_secret) so a self-host box
  "just works" without env config — while keeping plaintext keys out of the DB
  file and any DB backup. For multi-box / hosted deploys, set APP_SECRET
  explicitly so every instance can decrypt.
*/

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const SECRET_FILE = path.join(DATA_DIR, ".app_secret");

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  let secret = process.env.APP_SECRET;
  if (!secret) {
    // Fall back to a persisted random secret so self-host works out of the box.
    try {
      if (fs.existsSync(SECRET_FILE)) {
        secret = fs.readFileSync(SECRET_FILE, "utf8").trim();
      } else {
        secret = crypto.randomBytes(32).toString("hex");
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
      }
    } catch {
      // Last resort: derive an ephemeral key (won't survive restarts).
      secret = "insecure-ephemeral-secret-set-APP_SECRET";
    }
  }
  // Normalize any-length secret to a 32-byte key.
  cachedKey = crypto.createHash("sha256").update(secret).digest();
  return cachedKey;
}

/** Encrypt a UTF-8 string. Returns a self-describing token: v1:iv:tag:ciphertext (base64). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

/** Decrypt a token produced by encryptSecret. Returns "" on any failure. */
export function decryptSecret(token: string): string {
  try {
    const [v, ivB64, tagB64, dataB64] = token.split(":");
    if (v !== "v1") return "";
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

/** Show only the last 4 chars of a secret: "sk-...n4Kf". */
export function maskSecret(plaintext: string): string {
  if (!plaintext) return "";
  const tail = plaintext.slice(-4);
  return `••••••••${tail}`;
}
