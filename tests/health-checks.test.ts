import test from "node:test";
import assert from "node:assert/strict";
import {
  checkTitle,
  checkMetaDescription,
  checkCanonical,
  checkDocumentLanguage,
  checkHeadings,
  checkImageAlts,
  checkFormLabels,
  checkJsonLd,
  checkSecurityHeaders,
  checkHttpStatus,
  extractInternalLinks,
  runPageChecks,
} from "../lib/server/health/checks";

const base = (body: string, extra: Partial<{ url: string; status: number; headers: Record<string, string> }> = {}) => ({
  url: "https://example.com/",
  status: 200,
  headers: {},
  body,
  ...extra,
});

// --- SEO checks ---

test("checkTitle flags missing title", () => {
  const f = checkTitle(base("<html><head></head></html>"));
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "error");
  assert.equal(f[0].category, "seo");
});

test("checkTitle flags too-short and too-long titles", () => {
  assert.equal(checkTitle(base("<title>Hi</title>"))[0].severity, "warning");
  assert.equal(checkTitle(base(`<title>${"x".repeat(100)}</title>`))[0].severity, "warning");
  assert.equal(checkTitle(base("<title>A perfectly reasonable page title here</title>")).length, 0);
});

test("checkMetaDescription flags missing description", () => {
  const f = checkMetaDescription(base("<html><head></head></html>"));
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "warning");
});

test("checkCanonical flags missing canonical", () => {
  const f = checkCanonical(base("<html><head></head></html>"));
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "info");
  assert.equal(checkCanonical(base('<link rel="canonical" href="https://example.com/">')).length, 0);
});

// --- Accessibility checks ---

test("checkDocumentLanguage flags missing lang", () => {
  assert.equal(checkDocumentLanguage(base("<html><head></head></html>")).length, 1);
  assert.equal(checkDocumentLanguage(base('<html lang="en"><head></head></html>')).length, 0);
});

test("checkHeadings flags missing h1 and skipped levels", () => {
  const noH1 = checkHeadings(base("<h2>Sub</h2>"));
  assert.ok(noH1.some((f) => f.evidence.includes("No <h1>")));
  const skipped = checkHeadings(base("<h1>Top</h1><h3>Skipped</h3>"));
  assert.ok(skipped.some((f) => f.evidence.includes("Skipped heading level")));
  assert.equal(checkHeadings(base("<h1>Top</h1><h2>Sub</h2>")).length, 0);
});

test("checkImageAlts counts images without alt", () => {
  const f = checkImageAlts(base('<img src="a.jpg"><img src="b.jpg" alt="B">'));
  assert.equal(f.length, 1);
  assert.ok(f[0].evidence.includes("1 of 2"));
  assert.equal(checkImageAlts(base('<img src="a.jpg" alt="">')).length, 0);
  assert.equal(checkImageAlts(base("<p>No images</p>")).length, 0);
});

test("checkFormLabels flags unlabeled controls", () => {
  const f = checkFormLabels(base('<form><input type="text" name="q"></form>'));
  assert.equal(f.length, 1);
  assert.ok(f[0].evidence.includes("1 form control"));
  assert.equal(checkFormLabels(base('<label for="q">Q</label><input id="q" type="text">')).length, 0);
  assert.equal(checkFormLabels(base('<input type="hidden" name="t" value="1">')).length, 0);
});

// --- Structured data ---

test("checkJsonLd flags invalid JSON-LD", () => {
  const f = checkJsonLd(base('<script type="application/ld+json">{broken</script>'));
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "error");
  assert.equal(
    checkJsonLd(base('<script type="application/ld+json">{"@type":"WebSite"}</script>')).length,
    0,
  );
});

// --- Security headers (measured) ---

test("checkSecurityHeaders flags missing headers on HTTPS", () => {
  const f = checkSecurityHeaders(base("<html></html>"));
  const checks = f.map((x) => x.check);
  assert.ok(checks.includes("hsts"));
  assert.ok(checks.includes("csp"));
  assert.ok(!checks.includes("https"));
  assert.ok(f.every((x) => x.method === "measured"));
});

test("checkSecurityHeaders passes with good headers", () => {
  const f = checkSecurityHeaders(
    base("<html></html>", {
      headers: {
        "strict-transport-security": "max-age=31536000",
        "content-security-policy": "default-src 'self'",
        "x-frame-options": "SAMEORIGIN",
        "x-content-type-options": "nosniff",
      },
    }),
  );
  assert.equal(f.length, 0);
});

test("checkSecurityHeaders flags plain HTTP", () => {
  const f = checkSecurityHeaders(base("<html></html>", { url: "http://example.com/" }));
  assert.ok(f.some((x) => x.check === "https" && x.severity === "error"));
});

// --- HTTP status ---

test("checkHttpStatus passes on 200, flags errors", () => {
  assert.equal(checkHttpStatus(base("", { status: 200 })).length, 0);
  const f404 = checkHttpStatus(base("", { status: 404 }));
  assert.equal(f404[0].severity, "warning");
  const f500 = checkHttpStatus(base("", { status: 500 }));
  assert.equal(f500[0].severity, "error");
});

// --- Link extraction ---

test("extractInternalLinks returns same-origin links only", () => {
  const html = `<a href="/about">A</a><a href="https://example.com/contact">C</a>
    <a href="https://other.com/">X</a><a href="mailto:a@b.c">M</a><a href="#top">T</a>`;
  const links = extractInternalLinks(html, "https://example.com/");
  assert.deepEqual(links.sort(), ["https://example.com/about", "https://example.com/contact"]);
});

// --- Full page run ---

test("runPageChecks aggregates findings without fabrication", () => {
  const findings = runPageChecks(base("<html><head></head><body><p>Hi</p></body></html>"));
  assert.ok(findings.length > 0);
  // Every finding has the required shape.
  for (const f of findings) {
    assert.ok(["seo", "accessibility", "security", "performance", "crawlability"].includes(f.category));
    assert.ok(["error", "warning", "info"].includes(f.severity));
    assert.ok(f.evidence.length > 0);
    assert.ok(f.recommendation.length > 0);
    assert.ok(["measured", "heuristic"].includes(f.method));
  }
});
