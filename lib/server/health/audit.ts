import "server-only";
import { randomUUID } from "crypto";
import { safeFetch, validateTargetUrl, SafeFetchError, type SafeFetchResult } from "./safe-fetch";
import { runPageChecks, extractInternalLinks, type Finding } from "./checks";
import { query } from "@/lib/server/db";

/**
 * Phase 2 — Website Health Audit Engine: orchestration.
 *
 * On-demand audits (no scheduled runs). The audit runs synchronously inside
 * the API request with conservative crawl limits so it completes within a
 * normal HTTP request window:
 *
 * - Max 10 pages (homepage + up to 9 internal links, depth 1)
 * - 10s timeout per request, 2MB response cap, max 5 redirects per fetch
 * - Site-level checks: /robots.txt and /sitemap.xml
 *
 * Every finding is evidence-based (measured or heuristic). Nothing is
 * fabricated; unexecuted checks are never reported as passed.
 */

export const MAX_AUDIT_PAGES = 10;

export type AuditSummary = {
  id: string;
  targetUrl: string;
  status: "running" | "completed" | "failed";
  pagesCrawled: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  findingCounts: { error: number; warning: number; info: number };
};

export type AuditDetail = AuditSummary & {
  findings: Array<Finding & { id: string }>;
};

function finding(
  auditId: string,
  f: Finding,
): [string, string, string, string, string, string, string, string, string] {
  return [
    randomUUID(), auditId, f.category, f.severity, f.check,
    f.url.slice(0, 2048), f.evidence.slice(0, 1000),
    f.recommendation.slice(0, 1000), f.method,
  ];
}

async function storeFindings(auditId: string, findings: Finding[]): Promise<void> {
  for (const f of findings) {
    await query(
      `INSERT INTO health_findings(id,audit_id,category,severity,check_name,url,evidence,recommendation,method)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      finding(auditId, f),
    );
  }
}

function siteLevelFindings(
  targetUrl: string,
  robots: SafeFetchResult | null,
  sitemap: SafeFetchResult | null,
): Finding[] {
  const findings: Finding[] = [];
  const origin = new URL(targetUrl).origin;

  if (!robots || robots.status !== 200) {
    findings.push({
      category: "crawlability", severity: "info", check: "robots-txt",
      url: `${origin}/robots.txt`, method: "measured",
      evidence: robots ? `HTTP ${robots.status}` : "Could not fetch robots.txt.",
      recommendation: "Publish a robots.txt to guide crawlers (even if it allows everything).",
    });
  }
  if (!sitemap || sitemap.status !== 200) {
    findings.push({
      category: "seo", severity: "info", check: "sitemap",
      url: `${origin}/sitemap.xml`, method: "measured",
      evidence: sitemap ? `HTTP ${sitemap.status}` : "Could not fetch sitemap.xml.",
      recommendation: "Publish an XML sitemap and reference it in robots.txt.",
    });
  } else if (!sitemap.body.includes("<url") && !sitemap.body.includes("<sitemap")) {
    findings.push({
      category: "seo", severity: "warning", check: "sitemap",
      url: `${origin}/sitemap.xml`, method: "heuristic",
      evidence: "Sitemap does not appear to contain <url> or <sitemap> entries.",
      recommendation: "Ensure the sitemap lists the site's URLs in a valid XML sitemap format.",
    });
  }
  return findings;
}

/**
 * Run a full audit synchronously. Creates the audit row, crawls, checks,
 * stores findings, and marks completion. Throws SafeFetchError (safe message)
 * when the target itself cannot be fetched.
 */
export async function runHealthAudit(targetUrl: string): Promise<string> {
  const canonical = validateTargetUrl(targetUrl);
  const auditId = randomUUID();
  await query(
    `INSERT INTO health_audits(id,target_url,status) VALUES($1,$2,'running')`,
    [auditId, canonical.toString()],
  );

  const allFindings: Finding[] = [];
  try {
    // 1. Homepage.
    const home = await safeFetch(canonical.toString());
    allFindings.push(...runPageChecks({
      url: home.url, status: home.status, headers: home.headers, body: home.body,
    }));
    if (home.redirectChain.length > 0) {
      allFindings.push({
        category: "crawlability", severity: "info", check: "redirect-chain",
        url: canonical.toString(), method: "measured",
        evidence: `${home.redirectChain.length} redirect(s): ${home.redirectChain[0].slice(0, 120)} → …`,
        recommendation: "Link directly to the final URL to avoid redirect latency.",
      });
    }

    // 2. Internal pages (depth 1 from homepage), up to the page cap.
    const links = extractInternalLinks(home.body, home.url)
      .filter((u) => u !== home.url)
      .slice(0, MAX_AUDIT_PAGES - 1);
    let pagesCrawled = 1;
    for (const link of links) {
      try {
        const page = await safeFetch(link);
        pagesCrawled++;
        // Only run content checks on HTML pages.
        const ct = page.headers["content-type"] ?? "";
        if (page.status === 200 && (ct.includes("text/html") || !ct)) {
          allFindings.push(...runPageChecks({
            url: page.url, status: page.status, headers: page.headers, body: page.body,
          }));
        } else if (page.status >= 400) {
          allFindings.push({
            category: "crawlability", severity: page.status === 404 ? "warning" : "error",
            check: "broken-internal-link", url: page.url, method: "measured",
            evidence: `Linked from ${home.url.slice(0, 120)} — HTTP ${page.status}`,
            recommendation: "Fix or remove the broken internal link.",
          });
        }
      } catch (err) {
        // A single page failing doesn't fail the audit; record it.
        allFindings.push({
          category: "crawlability", severity: "info", check: "page-fetch",
          url: link.slice(0, 200), method: "measured",
          evidence: err instanceof SafeFetchError ? err.message : "Could not fetch page.",
          recommendation: "Check that the page is reachable.",
        });
      }
    }

    // 3. Site-level checks: robots.txt and sitemap.xml.
    const origin = new URL(home.url).origin;
    const [robots, sitemap] = await Promise.all([
      safeFetch(`${origin}/robots.txt`).catch(() => null),
      safeFetch(`${origin}/sitemap.xml`).catch(() => null),
    ]);
    allFindings.push(...siteLevelFindings(home.url, robots, sitemap));

    await storeFindings(auditId, allFindings);
    await query(
      `UPDATE health_audits SET status='completed', pages_crawled=$1, completed_at=CURRENT_TIMESTAMP(3) WHERE id=$2`,
      [pagesCrawled, auditId],
    );
    return auditId;
  } catch (err) {
    const message = err instanceof SafeFetchError ? err.message : "Audit failed unexpectedly.";
    await query(
      `UPDATE health_audits SET status='failed', error_message=$1, completed_at=CURRENT_TIMESTAMP(3) WHERE id=$2`,
      [message.slice(0, 500), auditId],
    );
    throw err instanceof SafeFetchError ? err : new SafeFetchError(message);
  }
}

export async function listAudits(limit = 20): Promise<AuditSummary[]> {
  const rows = await query<{
    id: string; target_url: string; status: string; pages_crawled: number;
    started_at: Date; completed_at: Date | null; error_message: string | null;
  }>(
    `SELECT id,target_url,status,pages_crawled,started_at,completed_at,error_message
     FROM health_audits ORDER BY started_at DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 50)],
  );
  return Promise.all(rows.rows.map(async (r) => ({
    id: r.id,
    targetUrl: r.target_url,
    status: r.status as AuditSummary["status"],
    pagesCrawled: r.pages_crawled,
    startedAt: new Date(r.started_at).toISOString(),
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    errorMessage: r.error_message,
    findingCounts: await findingCounts(r.id),
  })));
}

async function findingCounts(auditId: string): Promise<{ error: number; warning: number; info: number }> {
  const rows = await query<{ severity: string; n: number }>(
    `SELECT severity, COUNT(*) AS n FROM health_findings WHERE audit_id=$1 GROUP BY severity`,
    [auditId],
  );
  const counts = { error: 0, warning: 0, info: 0 };
  for (const r of rows.rows) {
    const n = Number(r.n) || 0;
    if (r.severity === "error") counts.error = n;
    else if (r.severity === "warning") counts.warning = n;
    else if (r.severity === "info") counts.info = n;
  }
  return counts;
}

export async function getAudit(id: string): Promise<AuditDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await query<{
    id: string; target_url: string; status: string; pages_crawled: number;
    started_at: Date; completed_at: Date | null; error_message: string | null;
  }>(`SELECT id,target_url,status,pages_crawled,started_at,completed_at,error_message FROM health_audits WHERE id=$1`, [id]);
  const r = rows.rows[0];
  if (!r) return null;
  const findings = await query<{
    id: string; category: string; severity: string; check_name: string;
    url: string; evidence: string; recommendation: string; method: string;
  }>(
    `SELECT id,category,severity,check_name,url,evidence,recommendation,method
     FROM health_findings WHERE audit_id=$1 ORDER BY
     FIELD(severity,'error','warning','info'), category, check_name`,
    [id],
  );
  return {
    id: r.id,
    targetUrl: r.target_url,
    status: r.status as AuditSummary["status"],
    pagesCrawled: r.pages_crawled,
    startedAt: new Date(r.started_at).toISOString(),
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    errorMessage: r.error_message,
    findingCounts: await findingCounts(r.id),
    findings: findings.rows.map((f) => ({
      id: f.id,
      category: f.category as Finding["category"],
      severity: f.severity as Finding["severity"],
      check: f.check_name,
      url: f.url,
      evidence: f.evidence,
      recommendation: f.recommendation,
      method: f.method as Finding["method"],
    })),
  };
}
