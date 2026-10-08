import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { listContent, saveDraft } from "@/lib/server/content/repository";
import { correlationId, readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { contentDraftSchema, contentKindSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await requireOwner();
    const kind = contentKindSchema.safeParse(new URL(request.url).searchParams.get("kind"));
    if (!kind.success) return NextResponse.json({ error: "Select a supported content collection." }, { status: 400 });
    return NextResponse.json({ records: await listContent(kind.data) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503 });
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    const parsed = contentDraftSchema.safeParse(await readJsonBody(request, 220_000));
    if (!parsed.success) return NextResponse.json({ error: "Draft content is invalid or too large." }, { status: 400 });
    await saveDraft(parsed.data.kind, parsed.data.key, parsed.data.draft, owner.userId, requestId);
    return NextResponse.json({ message: "Draft saved. It is not public until explicitly published." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error), requestId }, { status: 400 });
  }
}
