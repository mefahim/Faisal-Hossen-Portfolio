import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { setPropertyId, getConnectionStatus } from "@/lib/server/analytics/tokens";
import "@/lib/server/analytics/register-google-oauth";
import { correlationId, readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

const bodySchema = z.object({
  propertyId: z.string().min(1).max(100),
});

/**
 * Phase B Step 2 (PR-B): Save the selected GA4 property.
 *
 * POST, owner-only, same-origin CSRF protection. The property ID is validated
 * by `normalizePropertyId` (digits or properties/digits only) — arbitrary
 * IDs are rejected. The provider must be connected first.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });
  }
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();

    const rate = await consumeRateLimit(`ga4-propset:${owner.userId}`, 20, 600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retrySeconds) } },
      );
    }

    const body = bodySchema.safeParse(await readJsonBody(request, 4_000));
    if (!body.success) {
      return NextResponse.json({ error: "Invalid property ID." }, { status: 400, headers: noStore });
    }

    // Must be connected before selecting a property.
    const status = await getConnectionStatus("ga4", owner.userId);
    if (!status) {
      return NextResponse.json({ error: "Connect Google Analytics first." }, { status: 409, headers: noStore });
    }

    await setPropertyId("ga4", body.data.propertyId, owner.userId);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore });
    }
    console.error(`[${requestId}] Property selection failed: ${safeErrorMessage(error)}`);
    return NextResponse.json({ error: safeErrorMessage(error), requestId }, { status: 503, headers: noStore });
  }
}
