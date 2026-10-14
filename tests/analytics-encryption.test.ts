import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  encryptToken,
  decryptToken,
  getEncryptionKey,
  isEncryptionAvailable,
  EncryptionConfigError,
  DecryptionError,
} from "../lib/server/analytics/encryption";

const TEST_KEY = randomBytes(32);
const TEST_KEY_B64 = TEST_KEY.toString("base64");

function withKey<T>(key: string | undefined, fn: () => T): T {
  const prev = process.env.OAUTH_ENCRYPTION_KEY;
  if (key === undefined) delete process.env.OAUTH_ENCRYPTION_KEY;
  else process.env.OAUTH_ENCRYPTION_KEY = key;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.OAUTH_ENCRYPTION_KEY;
    else process.env.OAUTH_ENCRYPTION_KEY = prev;
  }
}

test("encryption round-trip recovers plaintext", () => {
  const plaintext = "ya29.test-access-token-12345";
  const encrypted = withKey(TEST_KEY_B64, () => encryptToken(plaintext));
  assert.notEqual(encrypted, plaintext);
  const decrypted = withKey(TEST_KEY_B64, () => decryptToken(encrypted));
  assert.equal(decrypted, plaintext);
});

test("encryption uses random nonce (same plaintext → different ciphertext)", () => {
  const a = withKey(TEST_KEY_B64, () => encryptToken("same-token"));
  const b = withKey(TEST_KEY_B64, () => encryptToken("same-token"));
  assert.notEqual(a, b);
});

test("tampered ciphertext is rejected", () => {
  const encrypted = withKey(TEST_KEY_B64, () => encryptToken("secret"));
  const [nonce, combined] = encrypted.split(".");
  const tampered = Buffer.from(combined, "base64");
  tampered[0] ^= 0xff;
  const payload = `${nonce}.${tampered.toString("base64")}`;
  assert.throws(() => withKey(TEST_KEY_B64, () => decryptToken(payload)), DecryptionError);
});

test("tampered nonce is rejected", () => {
  const encrypted = withKey(TEST_KEY_B64, () => encryptToken("secret"));
  const [, combined] = encrypted.split(".");
  const badNonce = randomBytes(12).toString("base64");
  assert.throws(
    () => withKey(TEST_KEY_B64, () => decryptToken(`${badNonce}.${combined}`)),
    DecryptionError,
  );
});

test("wrong key is rejected", () => {
  const encrypted = withKey(TEST_KEY_B64, () => encryptToken("secret"));
  const otherKey = randomBytes(32).toString("base64");
  assert.throws(() => withKey(otherKey, () => decryptToken(encrypted)), DecryptionError);
});

test("malformed payload is rejected", () => {
  withKey(TEST_KEY_B64, () => {
    assert.throws(() => decryptToken("not-a-valid-payload"), DecryptionError);
    assert.throws(() => decryptToken("a.b.c"), DecryptionError);
    assert.throws(() => decryptToken(""), DecryptionError);
    assert.throws(() => decryptToken("!!!.???"), DecryptionError);
  });
});

test("missing key throws EncryptionConfigError (fail closed)", () => {
  assert.throws(() => withKey(undefined, () => getEncryptionKey()), EncryptionConfigError);
  assert.throws(() => withKey(undefined, () => encryptToken("x")), EncryptionConfigError);
  assert.throws(() => withKey(undefined, () => decryptToken("a.b")), EncryptionConfigError);
  assert.equal(withKey(undefined, () => isEncryptionAvailable()), false);
});

test("invalid key length is rejected", () => {
  const shortKey = randomBytes(16).toString("base64");
  assert.throws(() => withKey(shortKey, () => getEncryptionKey()), EncryptionConfigError);
  const longKey = randomBytes(64).toString("base64");
  assert.throws(() => withKey(longKey, () => getEncryptionKey()), EncryptionConfigError);
});

test("non-base64 key is rejected", () => {
  assert.throws(() => withKey("not-valid-base64!!!", () => getEncryptionKey()), EncryptionConfigError);
});

test("empty plaintext is rejected", () => {
  assert.throws(() => withKey(TEST_KEY_B64, () => encryptToken("")), DecryptionError);
});

test("isEncryptionAvailable returns true with valid key", () => {
  assert.equal(withKey(TEST_KEY_B64, () => isEncryptionAvailable()), true);
});

test("explicit key parameter works without env var", () => {
  const encrypted = encryptToken("hello", TEST_KEY);
  const decrypted = decryptToken(encrypted, TEST_KEY);
  assert.equal(decrypted, "hello");
});
