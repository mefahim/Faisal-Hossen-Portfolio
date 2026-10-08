import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../lib/server/password-hashing";

const LEGACY_NODE_ARGON2_HASH = "$argon2id$v=19$m=19456,p=1,t=2$SpITqTSB/yqzK6X8p0awUA$X8tJWGAb5HDAff8USTV6xQJtrSnkC+iRTnIZmkf251M";

test("Argon2id verifies existing node-argon2 v19 PHC hashes", async () => {
  assert.equal(await verifyPassword(LEGACY_NODE_ARGON2_HASH, "phase1-legacy-argon2-fixture-password"), true);
  assert.equal(await verifyPassword(LEGACY_NODE_ARGON2_HASH, "wrong-password"), false);
});

test("new Argon2id hashes preserve the configured PHC policy", async () => {
  const password = "phase1-argon2-compatibility-test";
  const encoded = await hashPassword(password);

  assert.match(encoded, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await verifyPassword(encoded, password), true);
  assert.equal(await verifyPassword(encoded, `${password}-wrong`), false);
});
