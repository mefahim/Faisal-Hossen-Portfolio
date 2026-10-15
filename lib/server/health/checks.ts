import "server-only";

/**
 * Phase 2 — Website Health Audit: evidence-based checks.
 *
 * Each check is a pure function over a fetched page (HTML + headers) and
 * returns findings. Every finding carries: category, severity, check name,
 * affected URL, evidence, recommended fix, method (measured vs heuristic),
 * and is timestamped by the audit runner.
 *
 * HTML parsing is regex-based (no DOM/JS execution). Findings derived from
 * pattern matching are marked method:"heuristic"; findings from HTTP-level
 * facts (status codes, headers) are method:"measured". Nothing is fabricated.
 */

export type FindingSeverity = "error" | "warning" | "info";
export type FindingCategory = "seo" | "accessibility" | "security" | "performance" | "crawlability";
export type FindingMethod = "measured" | "heuristic";

export type Finding = {
  category: FindingCategory;
  severity: FindingSeverity;
  check: string;
  url: string;
  evidence: string;
  recommendation: string;
  method: FindingMethod;
};

type PageInput = {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
};

function tagContent(html: string, tag: string): string | null {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

function metaContent(html: string, attr: "name" | "property", value: string): string | null {
  // Matches <meta name="description" content="..."> in either attribute order.
  const patterns = [
    new RegExp(`<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${value}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

function linkHref(html: string, rel: string): string | null {
  const patterns = [
    new RegExp(`<link[^>]*rel=["']${rel}["'][^>]*href=["']([^"']*)["']`, "i"),
    new RegExp(`<link[^>]*href=["']([^"']*)["'][^>]*rel=["']${rel}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

/** All <img ...> tags in the HTML. */
function imgTags(html: string): string[] {
  return html.match(/<img\b[^>]*>/gi) ?? [];
}

/** All heading tags with their level and text. */
function headings(html: string): Array<{ level: number; text: string }> {
  const out: Array<{ level: number; text: string }> = [];
  const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ level: parseInt(m[1], 10), text: m[2].replace(/<[^>]*>/g, "").trim().slice(0, 120) });
  }
  return out;
}

/** Form controls that may need labels: input (non-hidden), textarea, select. */
function unlabeledControls(html: string): number {
  // Count inputs/textareas/selects, subtract those with id referenced by a <label for>.
  const labelFors = new Set<string>();
  const labelRe = /<label\b[^>]*for=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(html)) !== null) labelFors.add(m[1]);

  let unlabeled = 0;
  const controlRe = /<(input|textarea|select)\b([^>]*)>/gi;
  while ((m = controlRe.exec(html)) !== null) {
    const [, tag, attrs] = m;
    if (/type=["']hidden["']/i.test(attrs)) continue;
    if (/<label\b[^>]*>[\s\S]*?$/.test(html.slice(0, m.index).slice(-500))) {
      // Heuristic: wrapped in a label (checks last 500 chars for an open label).
      // Imperfect by design — marked heuristic.
      continue;
    }
    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    if (idMatch && labelFors.has(idMatch[1])) continue;
    if (/aria-label=["']/i.test(attrs) || /aria-labelledby=["']/i.test(attrs)) continue;
    void tag;
    unlabeled++;
  }
  return unlabeled;
}

export function checkHttpStatus(input: PageInput): Finding[] {
  const { url, status } = input;
  if (status >= 200 && status < 300) return [];
  if (status >= 300 && status < 400) {
    return [{
      category: "crawlability", severity: "warning", check: "http-status",
      url, evidence: `HTTP ${status} (redirect)`, method: "measured",
      recommendation: "Redirects add latency. Link directly to the final URL where possible.",
    }];
  }
  return [{
    category: "crawlability", severity: status >= 500 ? "error" : "warning", check: "http-status",
    url, evidence: `HTTP ${status}`, method: "measured",
    recommendation: status === 404
      ? "Fix or redirect this URL; remove links pointing to it."
      : "Investigate the server error and restore a 200 response.",
  }];
}

export function checkTitle(input: PageInput): Finding[] {
  const title = tagContent(input.body, "title");
  if (!title) {
    return [{ category: "seo", severity: "error", check: "title-tag", url: input.url, method: "heuristic",
      evidence: "No <title> tag found.", recommendation: "Add a unique, descriptive <title> (50–60 characters)." }];
  }
  if (title.length < 30 || title.length > 65) {
    return [{ category: "seo", severity: "warning", check: "title-tag", url: input.url, method: "heuristic",
      evidence: `Title is ${title.length} characters: "${title.slice(0, 80)}"`,
      recommendation: "Keep titles between 30–65 characters so they display fully in search results." }];
  }
  return [];
}

export function checkMetaDescription(input: PageInput): Finding[] {
  const desc = metaContent(input.body, "name", "description");
  if (!desc) {
    return [{ category: "seo", severity: "warning", check: "meta-description", url: input.url, method: "heuristic",
      evidence: "No meta description found.", recommendation: "Add a unique meta description (120–160 characters)." }];
  }
  if (desc.length < 70 || desc.length > 160) {
    return [{ category: "seo", severity: "info", check: "meta-description", url: input.url, method: "heuristic",
      evidence: `Meta description is ${desc.length} characters.`,
      recommendation: "Aim for 120–160 characters for optimal display in search results." }];
  }
  return [];
}

export function checkCanonical(input: PageInput): Finding[] {
  const canonical = linkHref(input.body, "canonical");
  if (!canonical) {
    return [{ category: "seo", severity: "info", check: "canonical", url: input.url, method: "heuristic",
      evidence: "No canonical link found.", recommendation: "Add <link rel=\"canonical\"> to declare the preferred URL." }];
  }
  return [];
}

export function checkRobotsMeta(input: PageInput): Finding[] {
  const robots = metaContent(input.body, "name", "robots");
  if (robots && /noindex/i.test(robots)) {
    return [{ category: "crawlability", severity: "warning", check: "robots-meta", url: input.url, method: "heuristic",
      evidence: `robots meta: "${robots}"`, recommendation: "This page is excluded from search indexing. Remove noindex if that is unintentional." }];
  }
  return [];
}

export function checkDocumentLanguage(input: PageInput): Finding[] {
  const m = input.body.match(/<html\b[^>]*\blang=["']([^"']*)["']/i);
  if (!m || !m[1].trim()) {
    return [{ category: "accessibility", severity: "warning", check: "document-language", url: input.url, method: "heuristic",
      evidence: "No lang attribute on <html>.", recommendation: "Add lang (e.g. <html lang=\"en\">) for screen readers and search." }];
  }
  return [];
}

export function checkHeadings(input: PageInput): Finding[] {
  const hs = headings(input.body);
  const findings: Finding[] = [];
  const h1s = hs.filter((h) => h.level === 1);
  if (hs.length > 0 && h1s.length === 0) {
    findings.push({ category: "accessibility", severity: "warning", check: "heading-hierarchy", url: input.url, method: "heuristic",
      evidence: "No <h1> found.", recommendation: "Use exactly one <h1> describing the page's main topic." });
  }
  if (h1s.length > 1) {
    findings.push({ category: "accessibility", severity: "info", check: "heading-hierarchy", url: input.url, method: "heuristic",
      evidence: `${h1s.length} <h1> tags found.`, recommendation: "Prefer a single <h1>; use <h2>–<h6> for subsections." });
  }
  for (let i = 1; i < hs.length; i++) {
    if (hs[i].level > hs[i - 1].level + 1) {
      findings.push({ category: "accessibility", severity: "info", check: "heading-hierarchy", url: input.url, method: "heuristic",
        evidence: `Skipped heading level: <h${hs[i - 1].level}> followed by <h${hs[i].level}> ("${hs[i].text.slice(0, 50)}").`,
        recommendation: "Don't skip heading levels; nest them sequentially." });
      break; // one finding per page is enough
    }
  }
  return findings;
}

export function checkImageAlts(input: PageInput): Finding[] {
  const imgs = imgTags(input.body);
  if (imgs.length === 0) return [];
  const missing = imgs.filter((tag) => !/\balt=/i.test(tag)).length;
  if (missing === 0) return [];
  return [{ category: "accessibility", severity: missing === imgs.length ? "warning" : "info",
    check: "image-alt", url: input.url, method: "heuristic",
    evidence: `${missing} of ${imgs.length} images lack an alt attribute.`,
    recommendation: "Add descriptive alt text to informative images; use alt=\"\" for decorative ones." }];
}

export function checkFormLabels(input: PageInput): Finding[] {
  const count = unlabeledControls(input.body);
  if (count === 0) return [];
  return [{ category: "accessibility", severity: "warning", check: "form-labels", url: input.url, method: "heuristic",
    evidence: `${count} form control(s) without an associated label.`,
    recommendation: "Associate every input with <label for> or aria-label." }];
}

export function checkJsonLd(input: PageInput): Finding[] {
  const scripts = [...input.body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (scripts.length === 0) return [];
  const broken = scripts.filter(([, json]) => {
    try { JSON.parse(json); return false; } catch { return true; }
  }).length;
  if (broken === 0) return [];
  return [{ category: "seo", severity: "error", check: "json-ld", url: input.url, method: "measured",
    evidence: `${broken} of ${scripts.length} JSON-LD blocks failed to parse.`,
    recommendation: "Fix the JSON syntax so search engines can read the structured data." }];
}

export function checkSecurityHeaders(input: PageInput): Finding[] {
  const findings: Finding[] = [];
  const h = input.headers;
  const isHttps = input.url.startsWith("https:");
  if (isHttps && !h["strict-transport-security"]) {
    findings.push({ category: "security", severity: "warning", check: "hsts", url: input.url, method: "measured",
      evidence: "Strict-Transport-Security header missing.",
      recommendation: "Send Strict-Transport-Security (e.g. max-age=31536000; includeSubDomains)." });
  }
  if (!h["content-security-policy"]) {
    findings.push({ category: "security", severity: "info", check: "csp", url: input.url, method: "measured",
      evidence: "Content-Security-Policy header missing.",
      recommendation: "Consider a Content-Security-Policy to mitigate XSS." });
  }
  const xfo = h["x-frame-options"];
  const frameAncestors = h["content-security-policy"]?.includes("frame-ancestors");
  if (!xfo && !frameAncestors) {
    findings.push({ category: "security", severity: "info", check: "clickjacking", url: input.url, method: "measured",
      evidence: "No X-Frame-Options or frame-ancestors directive.",
      recommendation: "Set X-Frame-Options: SAMEORIGIN or a frame-ancestors CSP directive." });
  }
  if (!h["x-content-type-options"]) {
    findings.push({ category: "security", severity: "info", check: "mime-sniffing", url: input.url, method: "measured",
      evidence: "X-Content-Type-Options header missing.",
      recommendation: "Send X-Content-Type-Options: nosniff." });
  }
  if (!isHttps) {
    findings.push({ category: "security", severity: "error", check: "https", url: input.url, method: "measured",
      evidence: "Page served over plain HTTP.", recommendation: "Serve the site over HTTPS with a valid certificate." });
  }
  return findings;
}

export function checkHttpsRedirect(input: PageInput, wasHttp: boolean): Finding[] {
  if (wasHttp && input.url.startsWith("https:")) return []; // upgraded fine
  return [];
}

/**
 * Extract same-origin internal links (http/https, same hostname) from HTML.
 * Returned as absolute URLs, deduplicated. Exported for the crawler.
 */
export function extractInternalLinks(html: string, baseUrl: string): string[] {
  let base: URL;
  try { base = new URL(baseUrl); } catch { return []; }
  const seen = new Set<string>();
  const re = /<a\b[^>]*\bhref=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw || /^(javascript:|mailto:|tel:|data:|#)/i.test(raw)) continue;
    try {
      const u = new URL(raw, base);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      if (u.hostname !== base.hostname) continue;
      u.hash = "";
      const s = u.toString();
      if (!seen.has(s)) seen.add(s);
    } catch { /* skip malformed */ }
  }
  return [...seen];
}

/** Run all per-page checks. */
export function runPageChecks(input: PageInput): Finding[] {
  return [
    ...checkHttpStatus(input),
    ...checkTitle(input),
    ...checkMetaDescription(input),
    ...checkCanonical(input),
    ...checkRobotsMeta(input),
    ...checkDocumentLanguage(input),
    ...checkHeadings(input),
    ...checkImageAlts(input),
    ...checkFormLabels(input),
    ...checkJsonLd(input),
    ...checkSecurityHeaders(input),
  ];
}
