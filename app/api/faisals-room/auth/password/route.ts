import { NextResponse } from "next/server";
import { changeOwnerPassword, requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { correlationId, readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { passwordChangeSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    const body = passwordChangeSchema.safeParse(await readJsonBody(request, 8_000));
    if (!body.success) return NextResponse.json({ error: "New password must be at least 14 characters." }, { status: 400 });
    await changeOwnerPassword(owner, body.data.currentPassword, body.data.newPassword, requestId);
    return NextResponse.json({ message: "Password updated. Other sessions have been revoked." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof Error && error.message === "Current password is incorrect.") return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: safeErrorMessage(error), requestId }, { status: 503 });
  }
}
