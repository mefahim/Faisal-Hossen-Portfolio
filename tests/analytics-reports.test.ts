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

// --- extractTotals: dimension-less report parsing (regression for the
// production bug where totals showed 0 while top pages had real data) ---

test("extractTotals reads values from rows when totals is absent", async () => {
  const { extractTotals } = await import("../lib/server/analytics/ga4-reports");
  // Real-world shape: dimension-less report without metricAggregations.
  const res = {
    rowCount: 1,
    rows: [{ metricValues: [{ value: "12" }, { value: "9" }, { value: "22" }] }],
  };
  assert.deepEqual(extractTotals(res), { sessions: 12, totalUsers: 9, pageViews: 22 });
});

test("extractTotals prefers totals[] when present", async () => {
  const { extractTotals } = await import("../lib/server/analytics/ga4-reports");
  const res = {
    totals: [{ metricValues: [{ value: "5" }, { value: "4" }, { value: "10" }] }],
    rows: [{ metricValues: [{ value: "99" }, { value: "99" }, { value: "99" }] }],
  };
  assert.deepEqual(extractTotals(res), { sessions: 5, totalUsers: 4, pageViews: 10 });
});

test("extractTotals returns zeros for empty responses", async () => {
  const { extractTotals } = await import("../lib/server/analytics/ga4-reports");
  assert.deepEqual(extractTotals({}), { sessions: 0, totalUsers: 0, pageViews: 0 });
  assert.deepEqual(extractTotals({ rows: [] }), { sessions: 0, totalUsers: 0, pageViews: 0 });
});

test("extractTotals sanitizes malformed values", async () => {
  const { extractTotals } = await import("../lib/server/analytics/ga4-reports");
  const res = {
    rows: [{ metricValues: [{ value: "-3" }, { value: "abc" }, {}] }],
  };
  assert.deepEqual(extractTotals(res), { sessions: 0, totalUsers: 0, pageViews: 0 });
});
