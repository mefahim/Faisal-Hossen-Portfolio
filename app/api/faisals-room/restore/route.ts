import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { restoreRevision } from "@/lib/server/content/repository";
import { correlationId, readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { restoreSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    const body = restoreSchema.safeParse(await readJsonBody(request, 8_000));
    if (!body.success) return NextResponse.json({ error: "Select a valid revision." }, { status: 400 });
    await restoreRevision(body.data.revisionId, owner.userId, requestId);
    return NextResponse.json({ message: "Revision restored as a new draft. Review it before publishing." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error && !error.message.startsWith("Database") ? error.message : safeErrorMessage(error), requestId }, { status: 400 });
  }
}
