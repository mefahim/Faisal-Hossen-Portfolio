import test from "node:test";
import assert from "node:assert/strict";
import { parsePropertyId, listGA4Properties } from "../lib/server/analytics/ga4-properties";
import { _setSessionOverride, _clearSessionOverride, _setTokenRefresh, storeTokens } from "../lib/server/analytics/tokens";
import { generateTestEncryptionKey, isTestDatabaseAvailable, runMigrations } from "./db-test-utils";
import { query, _closePool } from "../lib/server/db";

const dbAvailable = isTestDatabaseAvailable();
const skipNoDb = { skip: dbAvailable ? false : "DATABASE_URL not set; skipped." } as const;
const ACTOR = "test-owner-id";

// --- parsePropertyId (pure, no DB) ---

test("parsePropertyId extracts numeric ID", () => {
  assert.equal(parsePropertyId("properties/123456789"), "123456789");
});

test("parsePropertyId rejects malformed names", () => {
  assert.equal(parsePropertyId("properties/abc"), null);
  assert.equal(parsePropertyId("123456789"), null);
  assert.equal(parsePropertyId(""), null);
  assert.equal(parsePropertyId("properties/"), null);
  assert.equal(parsePropertyId("accounts/123/properties/456"), null);
});

// --- listGA4Properties (mocked fetch, needs DB for token storage) ---

async function setupConnected(): Promise<void> {
  process.env.OAUTH_ENCRYPTION_KEY = generateTestEncryptionKey();
  await runMigrations(process.cwd());
  _setSessionOverride({ userId: ACTOR });
  // Store a valid (non-expired) token directly
  await storeTokens(
    "ga4",
    { accessToken: "ya29.test", refreshToken: "1//test", expiresAt: new Date(Date.now() + 3600_000) },
    ACTOR,
  );
}

function mockAdminApi(pages: Array<{ accountSummaries?: unknown[]; nextPageToken?: string }>): () => void {
  const origFetch = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const page = pages[Math.min(call++, pages.length - 1)];
    return { ok: true, status: 200, json: async () => page };
  }) as typeof globalThis.fetch;
  return () => { globalThis.fetch = origFetch; };
}

test("listGA4Properties returns properties from account summaries", skipNoDb, async () => {
  await setupConnected();
  const restore = mockAdminApi([
    {
      accountSummaries: [
        {
          displayName: "Test Account",
          propertySummaries: [
            { property: "properties/111", displayName: "Site A" },
            { property: "properties/222", displayName: "Site B" },
          ],
        },
      ],
    },
  ]);
  try {
    const props = await listGA4Properties("ga4", ACTOR);
    assert.equal(props.length, 2);
    assert.equal(props[0].propertyId, "111");
    assert.equal(props[0].displayName, "Site A");
    assert.equal(props[0].accountName, "Test Account");
  } finally {
    restore();
    await query("DELETE FROM provider_tokens WHERE provider=$1", ["ga4"]);
    _clearSessionOverride();
  }
});

test("listGA4Properties handles pagination", skipNoDb, async () => {
  await setupConnected();
  const restore = mockAdminApi([
    {
      accountSummaries: [{ displayName: "A", propertySummaries: [{ property: "properties/111", displayName: "One" }] }],
      nextPageToken: "token123",
    },
    {
      accountSummaries: [{ displayName: "B", propertySummaries: [{ property: "properties/222", displayName: "Two" }] }],
    },
  ]);
  try {
    const props = await listGA4Properties("ga4", ACTOR);
    assert.equal(props.length, 2);
  } finally {
    restore();
    await query("DELETE FROM provider_tokens WHERE provider=$1", ["ga4"]);
    _clearSessionOverride();
  }
});

test("listGA4Properties skips malformed property names", skipNoDb, async () => {
  await setupConnected();
  const restore = mockAdminApi([
    {
      accountSummaries: [
        {
          displayName: "A",
          propertySummaries: [
            { property: "properties/111", displayName: "Good" },
            { property: "garbage", displayName: "Bad" },
            { property: "properties/abc", displayName: "Also bad" },
          ],
        },
      ],
    },
  ]);
  try {
    const props = await listGA4Properties("ga4", ACTOR);
    assert.equal(props.length, 1);
    assert.equal(props[0].propertyId, "111");
  } finally {
    restore();
    await query("DELETE FROM provider_tokens WHERE provider=$1", ["ga4"]);
    _clearSessionOverride();
  }
});

test("listGA4Properties returns empty for zero properties", skipNoDb, async () => {
  await setupConnected();
  const restore = mockAdminApi([{ accountSummaries: [] }]);
  try {
    const props = await listGA4Properties("ga4", ACTOR);
    assert.equal(props.length, 0);
  } finally {
    restore();
    await query("DELETE FROM provider_tokens WHERE provider=$1", ["ga4"]);
    _clearSessionOverride();
  }
});

test("listGA4Properties throws safe error on 401", skipNoDb, async () => {
  await setupConnected();
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: false, status: 401, json: async () => ({}) })) as unknown as typeof globalThis.fetch;
  try {
    await assert.rejects(listGA4Properties("ga4", ACTOR), /Reconnect your account/);
  } finally {
    globalThis.fetch = origFetch;
    await query("DELETE FROM provider_tokens WHERE provider=$1", ["ga4"]);
    _clearSessionOverride();
  }
});

test("listGA4Properties throws safe error on 403", skipNoDb, async () => {
  await setupConnected();
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: false, status: 403, json: async () => ({}) })) as unknown as typeof globalThis.fetch;
  try {
    await assert.rejects(listGA4Properties("ga4", ACTOR), /Reconnect your account/);
  } finally {
    globalThis.fetch = origFetch;
    await query("DELETE FROM provider_tokens WHERE provider=$1", ["ga4"]);
    _clearSessionOverride();
  }
});

test("listGA4Properties throws safe error on network failure", skipNoDb, async () => {
  await setupConnected();
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("down"); }) as typeof globalThis.fetch;
  try {
    await assert.rejects(listGA4Properties("ga4", ACTOR), /Could not reach Google/);
  } finally {
    globalThis.fetch = origFetch;
    await query("DELETE FROM provider_tokens WHERE provider=$1", ["ga4"]);
    _clearSessionOverride();
  }
});

// Cleanup
test("cleanup", skipNoDb, async () => {
  await _closePool();
});
