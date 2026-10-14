import test from "node:test";
import assert from "node:assert/strict";
import {
  redirectRuleSchema,
  normalizeTargetUrl,
  detectCycle,
  checkChainDepth,
  parseRedirectCsv,
  exportRedirectsCsv,
} from "../lib/server/content/redirects";

// --- URL validation ---

test("redirect rule accepts valid root-relative source and target", () => {
  const r = redirectRuleSchema.safeParse({ source_path: "/old-page", target_url: "/new-page", status_code: 301, is_active: false });
  assert.equal(r.success, true);
});

test("redirect rule accepts absolute https target", () => {
  const r = redirectRuleSchema.safeParse({ source_path: "/old", target_url: "https://example.com/new", status_code: 308, is_active: false });
  assert.equal(r.success, true);
});

test("redirect rule rejects http target (https only)", () => {
  const r = redirectRuleSchema.safeParse({ source_path: "/old", target_url: "http://example.com/new", status_code: 301, is_active: false });
  assert.equal(r.success, false);
});

test("redirect rule rejects protected source paths", () => {
  for (const p of ["/faisals-room", "/faisals-room/seo", "/api", "/api/redirects", "/API/test"]) {
    const r = redirectRuleSchema.safeParse({ source_path: p, target_url: "/x", status_code: 301, is_active: false });
    assert.equal(r.success, false, `should reject ${p}`);
  }
});

test("redirect rule rejects malformed source paths", () => {
  assert.equal(redirectRuleSchema.safeParse({ source_path: "no-slash", target_url: "/x", status_code: 301, is_active: false }).success, false);
  assert.equal(redirectRuleSchema.safeParse({ source_path: "//evil.com", target_url: "/x", status_code: 301, is_active: false }).success, false);
  assert.equal(redirectRuleSchema.safeParse({ source_path: "/bad%", target_url: "/x", status_code: 301, is_active: false }).success, false);
  assert.equal(redirectRuleSchema.safeParse({ source_path: "", target_url: "/x", status_code: 301, is_active: false }).success, false);
});

test("redirect rule rejects invalid status codes", () => {
  for (const code of [200, 303, 304, 404, 500]) {
    const r = redirectRuleSchema.safeParse({ source_path: "/a", target_url: "/b", status_code: code, is_active: false });
    assert.equal(r.success, false, `should reject ${code}`);
  }
});

test("redirect rule accepts all four valid status codes", () => {
  for (const code of [301, 302, 307, 308]) {
    const r = redirectRuleSchema.safeParse({ source_path: "/a", target_url: "/b", status_code: code, is_active: false });
    assert.equal(r.success, true, `should accept ${code}`);
  }
});

// --- Normalization ---

test("normalization preserves trailing slashes distinctly", () => {
  assert.equal(normalizeTargetUrl("/about"), "/about");
  assert.equal(normalizeTargetUrl("/about/"), "/about/");
  assert.notEqual(normalizeTargetUrl("/about"), normalizeTargetUrl("/about/"));
});

test("normalization preserves query strings", () => {
  assert.equal(normalizeTargetUrl("/page?a=1"), "/page?a=1");
  assert.notEqual(normalizeTargetUrl("/page?a=1"), normalizeTargetUrl("/page?a=2"));
});

test("normalization preserves percent-encoding without decoding", () => {
  assert.equal(normalizeTargetUrl("/caf%C3%A9"), "/caf%C3%A9");
  assert.notEqual(normalizeTargetUrl("/caf%C3%A9"), normalizeTargetUrl("/café"));
});

test("normalization preserves case sensitivity", () => {
  assert.notEqual(normalizeTargetUrl("/About"), normalizeTargetUrl("/about"));
});

test("normalization lowercases https hostname only", () => {
  assert.equal(normalizeTargetUrl("https://EXAMPLE.com/Path"), "https://example.com/Path");
  // Path case preserved
  assert.ok(normalizeTargetUrl("https://EXAMPLE.com/Path").includes("/Path"));
});

// --- Loop detection ---

test("detectCycle finds 2-node cycle", () => {
  const cycle = detectCycle([
    { source: "/a", target: "/b" },
    { source: "/b", target: "/a" },
  ]);
  assert.ok(cycle !== null);
  assert.ok(cycle.includes("/a") && cycle.includes("/b"));
});

test("detectCycle finds 3-node cycle", () => {
  const cycle = detectCycle([
    { source: "/a", target: "/b" },
    { source: "/b", target: "/c" },
    { source: "/c", target: "/a" },
  ]);
  assert.ok(cycle !== null);
});

test("detectCycle returns null for acyclic graph", () => {
  const cycle = detectCycle([
    { source: "/a", target: "/b" },
    { source: "/b", target: "/c" },
    { source: "/c", target: "https://example.com" },
  ]);
  assert.equal(cycle, null);
});

test("detectCycle ignores external targets", () => {
  const cycle = detectCycle([
    { source: "/a", target: "https://example.com" },
    { source: "/b", target: "https://example.com" },
  ]);
  assert.equal(cycle, null);
});

test("detectCycle finds self-loop", () => {
  const cycle = detectCycle([{ source: "/a", target: "/a" }]);
  assert.ok(cycle !== null);
});

// --- Chain depth ---

test("checkChainDepth allows chains within 5 hops", () => {
  const edges = [
    { source: "/a", target: "/b" },
    { source: "/b", target: "/c" },
    { source: "/c", target: "/d" },
  ];
  const { ok, chain } = checkChainDepth(edges, "/a");
  assert.equal(ok, true);
  assert.deepEqual(chain, ["/a", "/b", "/c", "/d"]);
});

test("checkChainDepth rejects chains exceeding 5 hops", () => {
  const edges = [
    { source: "/a", target: "/b" },
    { source: "/b", target: "/c" },
    { source: "/c", target: "/d" },
    { source: "/d", target: "/e" },
    { source: "/e", target: "/f" },
    { source: "/f", target: "/g" },
  ];
  const { ok } = checkChainDepth(edges, "/a");
  assert.equal(ok, false);
});

test("checkChainDepth terminates at external URL", () => {
  const edges = [
    { source: "/a", target: "/b" },
    { source: "/b", target: "https://example.com/final" },
  ];
  const { ok, chain } = checkChainDepth(edges, "/a");
  assert.equal(ok, true);
  assert.deepEqual(chain, ["/a", "/b", "https://example.com/final"]);
});

// --- CSV parsing ---

test("parseRedirectCsv handles valid input", () => {
  const { rows, errors } = parseRedirectCsv("source_path,target_url,status_code,is_active\n/old,/new,301,false\n");
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { source_path: "/old", target_url: "/new", status_code: "301", is_active: "false" });
});

test("parseRedirectCsv strips UTF-8 BOM", () => {
  const { rows, errors } = parseRedirectCsv("\uFEFFsource_path,target_url,status_code,is_active\n/a,/b,301,false\n");
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_path, "/a");
});

test("parseRedirectCsv handles quoted fields with commas", () => {
  const { rows, errors } = parseRedirectCsv('source_path,target_url,status_code,is_active\n"/old,page","/new",301,false\n');
  assert.equal(errors.length, 0);
  assert.equal(rows[0].source_path, "/old,page");
});

test("parseRedirectCsv handles CRLF line endings", () => {
  const { rows, errors } = parseRedirectCsv("source_path,target_url,status_code,is_active\r\n/a,/b,301,false\r\n");
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
});

test("parseRedirectCsv rejects bad header", () => {
  const { rows, errors } = parseRedirectCsv("wrong,header\n/a,/b,301,false\n");
  assert.equal(rows.length, 0);
  assert.ok(errors.length > 0);
  assert.match(errors[0], /header/i);
});

test("parseRedirectCsv rejects unclosed quotes", () => {
  const { rows, errors } = parseRedirectCsv('source_path,target_url,status_code,is_active\n"/a,/b,301,false\n');
  assert.equal(rows.length, 0);
  assert.ok(errors.length > 0);
});

test("parseRedirectCsv skips blank lines", () => {
  const { rows, errors } = parseRedirectCsv("source_path,target_url,status_code,is_active\n/a,/b,301,false\n\n/c,/d,302,true\n");
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
});

test("parseRedirectCsv rejects empty input", () => {
  const { rows, errors } = parseRedirectCsv("");
  assert.equal(rows.length, 0);
  assert.ok(errors.length > 0);
});

// --- CSV export ---

test("exportRedirectsCsv produces valid header and escapes commas", () => {
  const csv = exportRedirectsCsv([
    { id: "1", source_path: "/a", target_url: "/b", status_code: 301, is_active: false, created_by: "x", created_at: "", updated_at: "" },
    { id: "2", source_path: "/c,d", target_url: "https://example.com", status_code: 302, is_active: true, created_by: "x", created_at: "", updated_at: "" },
  ]);
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], "source_path,target_url,status_code,is_active");
  assert.equal(lines[1], "/a,/b,301,false");
  assert.equal(lines[2], '"/c,d",https://example.com,302,true');
});

test("exportRedirectsCsv round-trips through parser", () => {
  const rules = [
    { id: "1", source_path: "/old-page", target_url: "/new-page", status_code: 301 as const, is_active: false, created_by: "x", created_at: "", updated_at: "" },
  ];
  const csv = exportRedirectsCsv(rules);
  const { rows, errors } = parseRedirectCsv(csv);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_path, "/old-page");
});
