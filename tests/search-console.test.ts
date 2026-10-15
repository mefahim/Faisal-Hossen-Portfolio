import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidGscDateRange,
  gscDateRange,
} from "../lib/server/analytics/gsc-reports";
import { scopeForProvider, GSC_READONLY_SCOPE, GA4_READONLY_SCOPE } from "../lib/server/analytics/google-oauth";
import { normalizeSiteUrl } from "../lib/server/analytics/tokens";

// --- OAuth scope per provider ---

test("scopeForProvider returns webmasters.readonly for search_console", () => {
  assert.equal(scopeForProvider("search_console"), GSC_READONLY_SCOPE);
  assert.equal(scopeForProvider("search_console"), "https://www.googleapis.com/auth/webmasters.readonly");
});

test("scopeForProvider still returns analytics.readonly for ga4 (no regression)", () => {
  assert.equal(scopeForProvider("ga4"), GA4_READONLY_SCOPE);
  assert.equal(scopeForProvider("ga4"), "https://www.googleapis.com/auth/analytics.readonly");
});

test("scopeForProvider rejects unknown providers", () => {
  assert.throws(() => scopeForProvider("facebook"), /No OAuth scope/);
  assert.throws(() => scopeForProvider(""), /No OAuth scope/);
});

// --- Date range validation ---

test("isValidGscDateRange accepts 7d, 28d, 90d", () => {
  assert.equal(isValidGscDateRange("7d"), true);
  assert.equal(isValidGscDateRange("28d"), true);
  assert.equal(isValidGscDateRange("90d"), true);
});

test("isValidGscDateRange rejects invalid ranges", () => {
  assert.equal(isValidGscDateRange("30d"), false); // GA4-style, not GSC
  assert.equal(isValidGscDateRange("1d"), false);
  assert.equal(isValidGscDateRange(""), false);
  assert.equal(isValidGscDateRange("28D"), false);
  assert.equal(isValidGscDateRange("7d'; DROP TABLE--"), false);
});

// --- Date range computation (GSC 2-3 day data delay) ---

test("gscDateRange ends 3 days ago and spans the right length", () => {
  const { startDate, endDate } = gscDateRange("7d");
  const end = new Date(endDate + "T00:00:00Z");
  const start = new Date(startDate + "T00:00:00Z");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const endDiffDays = Math.round((today.getTime() - end.getTime()) / 86_400_000);
  assert.equal(endDiffDays, 3);

  const spanDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  assert.equal(spanDays, 7);
});

test("gscDateRange 28d and 90d span correctly", () => {
  for (const [range, expected] of [["28d", 28], ["90d", 90]] as const) {
    const { startDate, endDate } = gscDateRange(range);
    const spanDays =
      Math.round(
        (new Date(endDate + "T00:00:00Z").getTime() - new Date(startDate + "T00:00:00Z").getTime()) / 86_400_000,
      ) + 1;
    assert.equal(spanDays, expected, range);
  }
});

test("gscDateRange returns YYYY-MM-DD format", () => {
  const { startDate, endDate } = gscDateRange("28d");
  assert.match(startDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(endDate, /^\d{4}-\d{2}-\d{2}$/);
});

// --- Site URL normalization ---

test("normalizeSiteUrl accepts URL and sc-domain properties", () => {
  assert.equal(normalizeSiteUrl("https://faisalhossen.com/"), "https://faisalhossen.com/");
  assert.equal(normalizeSiteUrl("sc-domain:faisalhossen.com"), "sc-domain:faisalhossen.com");
  assert.equal(normalizeSiteUrl("  https://example.com/  "), "https://example.com/");
});

test("normalizeSiteUrl rejects invalid input", () => {
  assert.throws(() => normalizeSiteUrl(""), /Invalid Search Console site URL/);
  assert.throws(() => normalizeSiteUrl("not-a-url"), /Invalid Search Console site URL/);
  assert.throws(() => normalizeSiteUrl("ftp://example.com/"), /Invalid Search Console site URL/);
  assert.throws(() => normalizeSiteUrl("x".repeat(65)), /Invalid Search Console site URL/);
});

// --- getGscReport validation (requires DB; skipped without DATABASE_URL) ---

const dbAvailable = !!process.env.DATABASE_URL;

test("getGscReport rejects invalid date range before touching DB", { skip: !dbAvailable }, async () => {
  const { getGscReport } = await import("../lib/server/analytics/gsc-reports");
  await assert.rejects(() => getGscReport("some-owner-id", "999d"), /Invalid date range/);
  await assert.rejects(() => getGscReport("some-owner-id", "30d"), /Invalid date range/);
});

test("getGscReport rejects unauthenticated caller", { skip: !dbAvailable }, async () => {
  const { getGscReport } = await import("../lib/server/analytics/gsc-reports");
  await assert.rejects(() => getGscReport("non-owner-id", "28d"), /Unauthorized|not connected|Authentication/);
});
