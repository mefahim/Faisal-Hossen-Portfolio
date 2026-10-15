import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { getConnectionStatus, getValidAccessToken, setPropertyId } from "@/lib/server/analytics/tokens";
import { listGscSites } from "@/lib/server/analytics/gsc-client";
import "@/lib/server/analytics/register-google-oauth";
import { correlationId, readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

const bodySchema = z.object({
  siteUrl: z.string().min(1).max(64),
});

/**
 * Phase 2 — Search Console: save the selected site.
 *
 * POST, owner-only, same-origin CSRF protection. The submitted site URL is
 * validated against Google's live site list for the connected account —
 * an arbitrary or inaccessible site URL is rejected. The provider must be
 * connected first.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });
  }
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();

    const rate = await consumeRateLimit(`gsc-siteset:${owner.userId}`, 20, 600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retrySeconds) } },
      );
    }

    const body = bodySchema.safeParse(await readJsonBody(request, 4_000));
    if (!body.success) {
      return NextResponse.json({ error: "Invalid site URL." }, { status: 400, headers: noStore });
    }

    const status = await getConnectionStatus("search_console", owner.userId);
    if (!status) {
      return NextResponse.json({ error: "Connect Search Console first." }, { status: 409, headers: noStore });
    }

    // Prove the site belongs to the connected account before persisting.
    const accessToken = await getValidAccessToken("search_console", owner.userId);
    const sites = await listGscSites(accessToken);
    const match = sites.find((s) => s.siteUrl === body.data.siteUrl.trim());
    if (!match) {
      return NextResponse.json(
        { error: "That site is not available in Search Console for the connected account." },
        { status: 400, headers: noStore },
      );
    }

    await setPropertyId("search_console", match.siteUrl, owner.userId);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore });
    }
    console.error(`[${requestId}] GSC site selection failed: ${safeErrorMessage(error)}`);
    return NextResponse.json({ error: safeErrorMessage(error), requestId }, { status: 503, headers: noStore });
  }
}
