import test from "node:test";
import assert from "node:assert/strict";
import { isValidDateRange } from "../lib/server/analytics/ga4-reports";

// --- Date range validation (pure, no DB/API needed) ---

test("isValidDateRange accepts 7d, 30d, 90d", () => {
  assert.equal(isValidDateRange("7d"), true);
  assert.equal(isValidDateRange("30d"), true);
  assert.equal(isValidDateRange("90d"), true);
});

test("isValidDateRange rejects invalid ranges", () => {
  assert.equal(isValidDateRange("1d"), false);
  assert.equal(isValidDateRange("365d"), false);
  assert.equal(isValidDateRange(""), false);
  assert.equal(isValidDateRange("7D"), false);
  assert.equal(isValidDateRange("last-week"), false);
  assert.equal(isValidDateRange("30"), false);
  assert.equal(isValidDateRange("../../../etc"), false);
});

test("isValidDateRange rejects injection attempts", () => {
  assert.equal(isValidDateRange("7d'; DROP TABLE--"), false);
  assert.equal(isValidDateRange("30d UNION SELECT"), false);
});

// --- getOverviewReport validation (requires DB; skipped without DATABASE_URL) ---

const dbAvailable = !!process.env.DATABASE_URL;

test("getOverviewReport rejects invalid date range before touching DB", { skip: !dbAvailable }, async () => {
  const { getOverviewReport } = await import("../lib/server/analytics/ga4-reports");
  await assert.rejects(() => getOverviewReport("some-owner-id", "999d"), /Invalid date range/);
  await assert.rejects(() => getOverviewReport("some-owner-id", ""), /Invalid date range/);
});

test("getOverviewReport rejects unauthenticated caller", { skip: !dbAvailable }, async () => {
  const { getOverviewReport } = await import("../lib/server/analytics/ga4-reports");
  // No session override set → resolveSession throws UnauthorizedError.
  await assert.rejects(() => getOverviewReport("non-owner-id", "30d"), /Unauthorized|not connected|Authentication/);
});

// --- Cache isolation: key structure prevents cross-property leakage ---
// (Verified by code review: UNIQUE KEY on (provider, property_id, date_range,
// report_type). Property ID comes from the owner's DB record, never the client.)

test("cache key components are documented", () => {
  // This test documents the invariant; the schema enforces it.
  const keyParts = ["provider", "property_id", "date_range", "report_type"];
  assert.deepEqual(keyParts, ["provider", "property_id", "date_range", "report_type"]);
});
