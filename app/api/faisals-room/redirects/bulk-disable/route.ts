import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { bulkDisableRedirects } from "@/lib/server/content/redirects";
import { correlationId, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    const result = await bulkDisableRedirects(owner.userId);
    return NextResponse.json(
      { ...result, message: `${result.affected_count} rule(s) disabled (planning-only).`, planning_only: true },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error), requestId }, { status: 400 });
  }
}
