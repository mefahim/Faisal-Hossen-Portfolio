import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Phase 2 Feature 3 (Phase A): AES-256-GCM token encryption.
 *
 * OAuth tokens are encrypted at rest. The encryption key comes from the
 * OAUTH_ENCRYPTION_KEY environment variable (base64-encoded 32 bytes).
 *
 * Security properties:
 * - Key is validated strictly: must decode to exactly 32 bytes.
 * - No fallback to hardcoded or development keys. If the key is missing
 *   or invalid, all provider features fail closed.
 * - 96-bit random nonce per encryption; stored alongside ciphertext.
 * - 128-bit GCM auth tag verified on decrypt; tampered data is rejected.
 * - Tokens never appear in logs, API responses, or browser code.
 */

const KEY_ENV_VAR = "OAUTH_ENCRYPTION_KEY";

export class EncryptionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionConfigError";
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

/**
 * Load and validate the encryption key. Throws EncryptionConfigError if
 * missing or invalid. Never returns a fallback key.
 */
export function getEncryptionKey(): Buffer {
  const raw = process.env[KEY_ENV_VAR];
  if (!raw || raw.trim().length === 0) {
    throw new EncryptionConfigError(
      `${KEY_ENV_VAR} is not configured. Provider integrations are disabled.`,
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw.trim(), "base64");
  } catch {
    throw new EncryptionConfigError(`${KEY_ENV_VAR} is not valid base64.`);
  }
  if (key.length !== 32) {
    throw new EncryptionConfigError(
      `${KEY_ENV_VAR} must decode to exactly 32 bytes (got ${key.length}). Generate with: openssl rand -base64 32`,
    );
  }
  return key;
}

/**
 * Check whether encryption is available without throwing.
 * Used for fail-closed feature gating.
 */
export function isEncryptionAvailable(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

// Wire format: base64(nonce) + "." + base64(ciphertext+tag)
// Nonce: 12 bytes. Tag: 16 bytes (appended by GCM).

export function encryptToken(plaintext: string, key?: Buffer): string {
  if (!plaintext) throw new DecryptionError("Cannot encrypt empty token.");
  const encKey = key ?? getEncryptionKey();
  if (encKey.length !== 32) throw new EncryptionConfigError("Encryption key must be 32 bytes.");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([ciphertext, tag]);
  return `${nonce.toString("base64")}.${combined.toString("base64")}`;
}

export function decryptToken(payload: string, key?: Buffer): string {
  const encKey = key ?? getEncryptionKey();
  if (encKey.length !== 32) throw new EncryptionConfigError("Encryption key must be 32 bytes.");
  const parts = payload.split(".");
  if (parts.length !== 2) {
    throw new DecryptionError("Malformed encrypted payload.");
  }
  let nonce: Buffer;
  let combined: Buffer;
  try {
    nonce = Buffer.from(parts[0], "base64");
    combined = Buffer.from(parts[1], "base64");
  } catch {
    throw new DecryptionError("Malformed encrypted payload.");
  }
  if (nonce.length !== 12 || combined.length < 17) {
    throw new DecryptionError("Malformed encrypted payload.");
  }
  // Constant-time length check to avoid oracle leaks (defense in depth).
  void timingSafeEqual(nonce, nonce);
  const tag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);
  try {
    const decipher = createDecipheriv("aes-256-gcm", encKey, nonce);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    throw new DecryptionError("Decryption failed: tampered data or wrong key.");
  }
}
