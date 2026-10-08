import { NextResponse } from "next/server";
import { requireOwner, revokeCurrentSession, UnauthorizedError } from "@/lib/server/auth";
import { recordActivity } from "@/lib/server/audit";
import { correlationId, safeErrorMessage, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    await revokeCurrentSession();
    await recordActivity({ actorId: owner.userId, action: "auth.logout", entityType: "session", requestId });
    return NextResponse.json({ message: "Signed out." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error), requestId }, { status: 503 });
  }
}
