import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { getDraft } from "@/lib/server/content/repository";
import { safeErrorMessage } from "@/lib/server/security";
import { contentKindSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await requireOwner();
    const url = new URL(request.url);
    const kind = contentKindSchema.safeParse(url.searchParams.get("kind"));
    const key = url.searchParams.get("key") ?? "";
    if (!kind.success || !key || key.length > 200) return NextResponse.json({ error: "Preview target is invalid." }, { status: 400 });
    const draft = await getDraft(kind.data, key);
    if (!draft) return NextResponse.json({ error: "Draft was not found." }, { status: 404 });
    return NextResponse.json({ draft }, { headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503 });
  }
}
