import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  parseTokenResponse,
  getOAuthConfig,
  OAuthConfigError,
  GOOGLE_AUTH_URL,
  GA4_READONLY_SCOPE,
  OAUTH_CALLBACK_PATH,
} from "../lib/server/analytics/google-oauth";

// --- Config tests ---

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const validEnv = {
  GOOGLE_OAUTH_CLIENT_ID: "test-client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "test-client-secret",
  NEXT_PUBLIC_SITE_URL: "https://example.com",
};

test("getOAuthConfig returns config with exact redirect URI", () => {
  withEnv(validEnv, () => {
    const config = getOAuthConfig();
    assert.equal(config.clientId, "test-client-id");
    assert.equal(config.clientSecret, "test-client-secret");
    assert.equal(config.redirectUri, `https://example.com${OAUTH_CALLBACK_PATH}`);
  });
});

test("getOAuthConfig strips trailing slash from site URL", () => {
  withEnv({ ...validEnv, NEXT_PUBLIC_SITE_URL: "https://example.com/" }, () => {
    const config = getOAuthConfig();
    assert.equal(config.redirectUri, `https://example.com${OAUTH_CALLBACK_PATH}`);
  });
});

test("getOAuthConfig throws on missing client ID", () => {
  withEnv({ ...validEnv, GOOGLE_OAUTH_CLIENT_ID: undefined }, () => {
    assert.throws(() => getOAuthConfig(), OAuthConfigError);
  });
});

test("getOAuthConfig throws on missing client secret", () => {
  withEnv({ ...validEnv, GOOGLE_OAUTH_CLIENT_SECRET: undefined }, () => {
    assert.throws(() => getOAuthConfig(), OAuthConfigError);
  });
});

test("getOAuthConfig throws on missing site URL", () => {
  withEnv({ ...validEnv, NEXT_PUBLIC_SITE_URL: undefined }, () => {
    assert.throws(() => getOAuthConfig(), OAuthConfigError);
  });
});

// --- Token response parsing ---

test("parseTokenResponse accepts valid response", () => {
  const tokens = parseTokenResponse({
    access_token: "ya29.abc",
    refresh_token: "1//def",
    expires_in: 3600,
  });
  assert.equal(tokens.accessToken, "ya29.abc");
  assert.equal(tokens.refreshToken, "1//def");
  assert.ok(tokens.expiresAt.getTime() > Date.now());
});

test("parseTokenResponse rejects missing access token", () => {
  assert.throws(() => parseTokenResponse({ refresh_token: "1//def" }), /missing access token/);
});

test("parseTokenResponse rejects missing refresh token", () => {
  assert.throws(
    () => parseTokenResponse({ access_token: "ya29.abc" }),
    /no refresh token issued/,
  );
});

test("parseTokenResponse defaults expiry when expires_in missing", () => {
  const tokens = parseTokenResponse({ access_token: "a", refresh_token: "r" });
  assert.ok(tokens.expiresAt.getTime() > Date.now());
});

// --- buildAuthorizationUrl (requires DB for state persistence) ---

import { isTestDatabaseAvailable, runMigrations, generateTestEncryptionKey } from "./db-test-utils";
import { query, _closePool } from "../lib/server/db";

const dbAvailable = isTestDatabaseAvailable();
const skipNoDb = { skip: dbAvailable ? false : "DATABASE_URL not set; skipped." } as const;

test("buildAuthorizationUrl creates valid Google URL with PKCE", skipNoDb, async () => {
  process.env.OAUTH_ENCRYPTION_KEY = generateTestEncryptionKey();
  await runMigrations(process.cwd());
  await withEnvAsync(validEnv, async () => {
    const { url } = await buildAuthorizationUrl("ga4");
    const parsed = new URL(url);
    assert.equal(`${parsed.origin}${parsed.pathname}`, GOOGLE_AUTH_URL);
    assert.equal(parsed.searchParams.get("client_id"), "test-client-id");
    assert.equal(parsed.searchParams.get("redirect_uri"), `https://example.com${OAUTH_CALLBACK_PATH}`);
    assert.equal(parsed.searchParams.get("response_type"), "code");
    assert.equal(parsed.searchParams.get("scope"), GA4_READONLY_SCOPE);
    assert.equal(parsed.searchParams.get("access_type"), "offline");
    assert.equal(parsed.searchParams.get("prompt"), "consent");
    assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
    assert.ok(parsed.searchParams.get("state")!.length >= 40);
    assert.ok(parsed.searchParams.get("code_challenge")!.length >= 40);
    // State was persisted
    const rows = await query("SELECT state FROM oauth_states WHERE provider=$1", ["ga4"]);
    assert.equal(rows.rowCount, 1);
    // Cleanup
    await query("DELETE FROM oauth_states WHERE provider=$1", ["ga4"]);
  });
});

async function withEnvAsync(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    await fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

// --- Mocked fetch tests (no DB, no network) ---

type MockFetch = typeof globalThis.fetch;

function mockFetchOnce(response: { ok: boolean; status?: number; json: unknown }): MockFetch {
  return (async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: async () => response.json,
  })) as unknown as MockFetch;
}

test("exchangeCodeForTokens succeeds with valid response", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = mockFetchOnce({
    ok: true,
    json: { access_token: "ya29.new", refresh_token: "1//new", expires_in: 3600 },
  });
  try {
    await withEnvAsync(validEnv, async () => {
      const tokens = await exchangeCodeForTokens("auth-code", "verifier", `https://example.com${OAUTH_CALLBACK_PATH}`);
      assert.equal(tokens.accessToken, "ya29.new");
      assert.equal(tokens.refreshToken, "1//new");
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("exchangeCodeForTokens rejects on Google error", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = mockFetchOnce({ ok: false, status: 400, json: { error: "invalid_grant" } });
  try {
    await withEnvAsync(validEnv, async () => {
      await assert.rejects(
        exchangeCodeForTokens("bad-code", "verifier", `https://example.com${OAUTH_CALLBACK_PATH}`),
        /Google rejected/,
      );
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("exchangeCodeForTokens rejects on redirect URI mismatch", async () => {
  await withEnvAsync(validEnv, async () => {
    await assert.rejects(
      exchangeCodeForTokens("code", "verifier", "https://evil.com/callback"),
      OAuthConfigError,
    );
  });
});

test("exchangeCodeForTokens rejects on network failure", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("network down"); };
  try {
    await withEnvAsync(validEnv, async () => {
      await assert.rejects(
        exchangeCodeForTokens("code", "verifier", `https://example.com${OAUTH_CALLBACK_PATH}`),
        /could not reach Google/,
      );
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("refreshAccessToken preserves refresh token when not rotated", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = mockFetchOnce({
    ok: true,
    json: { access_token: "ya29.refreshed", expires_in: 3600 },
  });
  try {
    await withEnvAsync(validEnv, async () => {
      const tokens = await refreshAccessToken("1//original");
      assert.equal(tokens.accessToken, "ya29.refreshed");
      assert.equal(tokens.refreshToken, "1//original");
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("refreshAccessToken adopts rotated refresh token", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = mockFetchOnce({
    ok: true,
    json: { access_token: "ya29.r2", refresh_token: "1//rotated", expires_in: 3600 },
  });
  try {
    await withEnvAsync(validEnv, async () => {
      const tokens = await refreshAccessToken("1//original");
      assert.equal(tokens.refreshToken, "1//rotated");
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("refreshAccessToken rejects on Google error", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = mockFetchOnce({ ok: false, status: 401, json: { error: "invalid_grant" } });
  try {
    await withEnvAsync(validEnv, async () => {
      await assert.rejects(refreshAccessToken("1//revoked"), /Google rejected/);
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Cleanup: close the DB pool so the test runner exits.
test("cleanup", skipNoDb, async () => {
  await _closePool();
});
