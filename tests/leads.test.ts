import test from "node:test";
import assert from "node:assert/strict";
import {
  parseLeadsParams,
  buildLeadsQuery,
  isValidLeadStatus,
  LEAD_STATUSES,
} from "../lib/server/leads";
import { leadStatusSchema } from "../lib/server/validation";

// --- Status validation ---

test("LEAD_STATUSES matches the approved five-state workflow", () => {
  assert.deepEqual([...LEAD_STATUSES], ["new", "reviewing", "qualified", "won", "archived"]);
});

test("isValidLeadStatus accepts the five states, rejects others", () => {
  for (const s of LEAD_STATUSES) assert.equal(isValidLeadStatus(s), true);
  assert.equal(isValidLeadStatus("read"), false);
  assert.equal(isValidLeadStatus("replied"), false);
  assert.equal(isValidLeadStatus(""), false);
  assert.equal(isValidLeadStatus("NEW"), false);
});

test("leadStatusSchema accepts valid transitions, rejects invalid", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(leadStatusSchema.safeParse({ id, status: "qualified" }).success, true);
  assert.equal(leadStatusSchema.safeParse({ id, status: "read" }).success, false);
  assert.equal(leadStatusSchema.safeParse({ id: "not-a-uuid", status: "new" }).success, false);
  assert.equal(leadStatusSchema.safeParse({ id }).success, false);
});

// --- Param parsing ---

test("parseLeadsParams applies defaults", () => {
  const p = parseLeadsParams(new URLSearchParams());
  assert.deepEqual(p, { q: "", status: "", page: 1, limit: 20 });
});

test("parseLeadsParams sanitizes page and limit", () => {
  assert.equal(parseLeadsParams(new URLSearchParams({ page: "0" })).page, 1);
  assert.equal(parseLeadsParams(new URLSearchParams({ page: "-5" })).page, 1);
  assert.equal(parseLeadsParams(new URLSearchParams({ page: "abc" })).page, 1);
  assert.equal(parseLeadsParams(new URLSearchParams({ limit: "500" })).limit, 100);
  assert.equal(parseLeadsParams(new URLSearchParams({ limit: "0" })).limit, 20);
  assert.equal(parseLeadsParams(new URLSearchParams({ page: "3", limit: "50" })).page, 3);
});

test("parseLeadsParams trims and caps the search query", () => {
  assert.equal(parseLeadsParams(new URLSearchParams({ q: "  hello  " })).q, "hello");
  assert.equal(parseLeadsParams(new URLSearchParams({ q: "x".repeat(200) })).q.length, 100);
});

test("parseLeadsParams rejects invalid status filter", () => {
  assert.equal(parseLeadsParams(new URLSearchParams({ status: "read" })).status, "");
  assert.equal(parseLeadsParams(new URLSearchParams({ status: "won" })).status, "won");
});

// --- Query building ---

test("buildLeadsQuery with no filters selects the latest page", () => {
  const q = buildLeadsQuery({ q: "", status: "", page: 1, limit: 20 });
  assert.ok(!q.whereClause.includes("WHERE"));
  assert.ok(q.listSql.includes("ORDER BY created_at DESC LIMIT $1 OFFSET $2"));
  assert.deepEqual(q.params, [20, 0]);
  assert.ok(q.countSql.includes("COUNT(*)"));
});

test("buildLeadsQuery paginates correctly", () => {
  const q = buildLeadsQuery({ q: "", status: "", page: 3, limit: 20 });
  assert.deepEqual(q.params, [20, 40]);
});

test("buildLeadsQuery filters by status with a placeholder", () => {
  const q = buildLeadsQuery({ q: "", status: "new", page: 1, limit: 20 });
  assert.ok(q.whereClause.includes("status = $1"));
  assert.ok(!q.listSql.includes("'new'")); // no string interpolation
  assert.deepEqual(q.params.slice(0, 1), ["new"]);
});

test("buildLeadsQuery escapes LIKE wildcards in search", () => {
  const q = buildLeadsQuery({ q: "100%_sure\\", status: "", page: 1, limit: 20 });
  const searchParam = q.params[0] as string;
  assert.ok(searchParam.includes("\\%"));
  assert.ok(searchParam.includes("\\_"));
  assert.ok(searchParam.includes("\\\\"));
  assert.ok(q.listSql.includes("ESCAPE '\\'"));
});

test("buildLeadsQuery combines status and search", () => {
  const q = buildLeadsQuery({ q: "acme", status: "qualified", page: 2, limit: 10 });
  assert.ok(q.whereClause.includes("status = $1"));
  assert.ok(q.whereClause.includes("LIKE $2"));
  assert.ok(!q.whereClause.includes("ILIKE")); // MariaDB has no ILIKE
  assert.ok(q.whereClause.includes(" AND "));
  assert.deepEqual(q.params, ["qualified", "%acme%", 10, 10]);
});

test("buildLeadsQuery never interpolates user input into SQL", () => {
  const evil = "'; DROP TABLE contact_submissions; --";
  const q = buildLeadsQuery({ q: evil, status: "", page: 1, limit: 20 });
  assert.ok(!q.listSql.includes(evil));
  assert.ok(!q.countSql.includes(evil));
  // Passed as a bound value (with LIKE wildcards escaped), never in the SQL text.
  const bound = q.params[0] as string;
  assert.ok(bound.includes("DROP TABLE"));
  assert.ok(bound.includes("\\_")); // underscore escaped for LIKE
});
