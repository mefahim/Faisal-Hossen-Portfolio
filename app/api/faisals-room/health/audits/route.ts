import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { listAudits, runHealthAudit, getAudit } from "@/lib/server/health/audit";
import { SafeFetchError } from "@/lib/server/health/safe-fetch";
import { correlationId, readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

const startSchema = z.object({
  targetUrl: z.string().min(1).max(2048),
});

/**
 * Phase 2 — Website Health Audit: list audit history.
 *
 * GET, owner-only. Returns recent audits with finding counts (no findings detail).
 */
export async function GET() {
  try {
    await requireOwner();
    const audits = await listAudits(20);
    return NextResponse.json({ audits }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503, headers: noStore });
  }
}

/**
 * Phase 2 — Website Health Audit: run a new on-demand audit.
 *
 * POST, owner-only, same-origin CSRF protection. The audit runs synchronously
 * with conservative crawl limits (max 10 pages). Rate limited: 5 audits per
 * hour per owner (each audit makes multiple outbound requests).
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });
  }
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();

    const rate = await consumeRateLimit(`health-audit:${owner.userId}`, 5, 3600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many audits. Please wait before running another." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retrySeconds) } },
      );
    }

    const body = startSchema.safeParse(await readJsonBody(request, 4_000));
    if (!body.success) {
      return NextResponse.json({ error: "Provide a valid target URL." }, { status: 400, headers: noStore });
    }

    const auditId = await runHealthAudit(body.data.targetUrl);
    const audit = await getAudit(auditId);
    return NextResponse.json({ audit }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore });
    }
    if (error instanceof SafeFetchError) {
      console.error(`[${requestId}] Health audit target error: ${safeErrorMessage(error)}`);
      return NextResponse.json({ error: error.message, requestId }, { status: 422, headers: noStore });
    }
    console.error(`[${requestId}] Health audit failed: ${safeErrorMessage(error)}`);
    return NextResponse.json({ error: "The audit could not be completed.", requestId }, { status: 503, headers: noStore });
  }
}
