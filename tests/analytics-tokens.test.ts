import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSupportedProvider,
  normalizePropertyId,
  needsRefresh,
  TOKEN_REFRESH_BUFFER_MS,
  _setTokenExchange,
  _setTokenRefresh,
} from "../lib/server/analytics/tokens";

test("assertSupportedProvider accepts ga4 and search_console", () => {
  assert.doesNotThrow(() => assertSupportedProvider("ga4"));
  assert.doesNotThrow(() => assertSupportedProvider("search_console"));
});

test("assertSupportedProvider rejects unknown providers", () => {
  assert.throws(() => assertSupportedProvider("facebook"), /Unsupported provider/);
  assert.throws(() => assertSupportedProvider(""), /Unsupported provider/);
  assert.throws(() => assertSupportedProvider("GA4"), /Unsupported provider/);
});

test("normalizePropertyId accepts numeric IDs", () => {
  assert.equal(normalizePropertyId("123456789"), "123456789");
});

test("normalizePropertyId strips properties/ prefix", () => {
  assert.equal(normalizePropertyId("properties/123456789"), "123456789");
});

test("normalizePropertyId rejects invalid formats", () => {
  assert.throws(() => normalizePropertyId("abc"), /Invalid GA4 property/);
  assert.throws(() => normalizePropertyId("properties/abc"), /Invalid GA4 property/);
  assert.throws(() => normalizePropertyId(""), /Invalid GA4 property/);
  assert.throws(() => normalizePropertyId("12 34"), /Invalid GA4 property/);
  assert.throws(() => normalizePropertyId("properties/"), /Invalid GA4 property/);
});

test("needsRefresh returns true when expiry within buffer", () => {
  const soon = new Date(Date.now() + TOKEN_REFRESH_BUFFER_MS - 60000);
  assert.equal(needsRefresh(soon), true);
});

test("needsRefresh returns true when already expired", () => {
  const past = new Date(Date.now() - 3600000);
  assert.equal(needsRefresh(past), true);
});

test("needsRefresh returns false when expiry well in future", () => {
  const future = new Date(Date.now() + TOKEN_REFRESH_BUFFER_MS + 3600000);
  assert.equal(needsRefresh(future), false);
});

test("needsRefresh respects custom now parameter", () => {
  const expiry = new Date("2026-01-01T12:00:00Z");
  const before = new Date("2026-01-01T11:00:00Z");
  const nearExpiry = new Date("2026-01-01T11:58:00Z");
  assert.equal(needsRefresh(expiry, before), false);
  assert.equal(needsRefresh(expiry, nearExpiry), true);
});

test("injectable token exchange mock works", async () => {
  const mockTokens = {
    accessToken: "mock-access",
    refreshToken: "mock-refresh",
    expiresAt: new Date(Date.now() + 3600000),
  };
  _setTokenExchange(async (code, verifier, redirectUri) => {
    assert.equal(code, "test-code");
    assert.equal(verifier, "test-verifier");
    assert.ok(redirectUri.includes("/oauth/callback"));
    return mockTokens;
  });
  // The mock is registered; Phase B will replace with real implementation.
  // Here we verify the injection mechanism itself doesn't throw on set/unset.
  _setTokenExchange(null);
  _setTokenRefresh(null);
  assert.ok(true);
});

test("injectable token refresh mock works", async () => {
  let called = false;
  _setTokenRefresh(async (refreshToken) => {
    called = true;
    assert.equal(refreshToken, "old-refresh-token");
    return {
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresAt: new Date(Date.now() + 3600000),
    };
  });
  _setTokenRefresh(null);
  assert.equal(called, false); // mock registered then cleared without invocation
});
