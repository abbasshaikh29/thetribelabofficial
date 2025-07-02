import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

// Require ENCRYPTION_SECRET to be set – do NOT allow fallback defaults
const { ENCRYPTION_SECRET } = process.env;

if (!ENCRYPTION_SECRET) {
  throw new Error(
    "ENCRYPTION_SECRET environment variable is not set. Encryption operations cannot proceed."
  );
}

// Derive a 32-byte key from the secret to satisfy AES-256 length requirement
const KEY = crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();

/**
 * Encrypt a UTF-8 string and return a base64-encoded payload in the format
 * iv:tag:ciphertext – each part base64-encoded and delimited by a colon.
 */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12); // 96-bit nonce recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

/**
 * Decrypt a payload produced by `encrypt`.
 */
export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload format");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
} 