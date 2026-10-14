import test from "node:test";
import assert from "node:assert/strict";
import {
  createOAuthChallenge,
  consumeOAuthState,
  verifyCodeChallenge,
  OAUTH_STATE_TTL_MS,
  _injectState,
  _stateStoreSize,
} from "../lib/server/analytics/oauth-state";

test("createOAuthChallenge returns state, verifier, and challenge", () => {
  const c = createOAuthChallenge("ga4");
  assert.ok(c.state.length >= 40);
  assert.ok(c.codeVerifier.length >= 40);
  assert.ok(c.codeChallenge.length >= 40);
  assert.notEqual(c.codeVerifier, c.codeChallenge);
});

test("verifier and challenge are consistent (S256)", () => {
  const c = createOAuthChallenge("ga4");
  assert.equal(verifyCodeChallenge(c.codeVerifier, c.codeChallenge), true);
});

test("consumeOAuthState returns verifier for valid state", () => {
  const c = createOAuthChallenge("ga4");
  const verifier = consumeOAuthState(c.state, "ga4");
  assert.equal(verifier, c.codeVerifier);
});

test("state is single-use (replay rejected)", () => {
  const c = createOAuthChallenge("ga4");
  consumeOAuthState(c.state, "ga4");
  assert.throws(() => consumeOAuthState(c.state, "ga4"), /Invalid or expired/);
});

test("unknown state is rejected", () => {
  assert.throws(() => consumeOAuthState("nonexistent-state-token", "ga4"), /Invalid or expired/);
});

test("expired state is rejected", () => {
  const state = "expired-test-state";
  _injectState(state, "verifier", Date.now() - OAUTH_STATE_TTL_MS - 1000, "ga4");
  assert.throws(() => consumeOAuthState(state, "ga4"), /expired/);
});

test("provider mismatch is rejected", () => {
  const c = createOAuthChallenge("ga4");
  assert.throws(() => consumeOAuthState(c.state, "search_console"), /mismatch/);
});

test("verifyCodeChallenge rejects wrong verifier", () => {
  const c = createOAuthChallenge("ga4");
  assert.equal(verifyCodeChallenge("wrong-verifier", c.codeChallenge), false);
});

test("verifyCodeChallenge rejects empty inputs", () => {
  assert.equal(verifyCodeChallenge("", "abc"), false);
  assert.equal(verifyCodeChallenge("abc", ""), false);
});

test("each challenge has unique state", () => {
  const a = createOAuthChallenge("ga4");
  const b = createOAuthChallenge("ga4");
  assert.notEqual(a.state, b.state);
  assert.notEqual(a.codeVerifier, b.codeVerifier);
});

test("expired states are cleaned from store", () => {
  const before = _stateStoreSize();
  _injectState("cleanup-test", "v", Date.now() - OAUTH_STATE_TTL_MS - 5000, "ga4");
  // Consuming the expired entry removes it
  assert.throws(() => consumeOAuthState("cleanup-test", "ga4"), /expired/);
  assert.ok(_stateStoreSize() <= before);
});
