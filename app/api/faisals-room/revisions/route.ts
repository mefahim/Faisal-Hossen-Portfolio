import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { safeErrorMessage } from "@/lib/server/security";
import { contentKindSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await requireOwner();
    const url = new URL(request.url);
    const kind = contentKindSchema.safeParse(url.searchParams.get("kind"));
    const key = url.searchParams.get("key") ?? "";
    if (!kind.success || !key || key.length > 200) return NextResponse.json({ error: "Revision target is invalid." }, { status: 400 });
    const entityType = kind.data === "pages" ? "page" : kind.data === "projects" ? "project" : kind.data === "navigation" ? "navigation" : kind.data === "seo" ? "seo" : "settings";
    const rows = (await query<{ id: string; publish_state: string; created_at: Date; restores_revision_id: string | null }>("SELECT id,publish_state,created_at,restores_revision_id FROM revisions WHERE entity_type=$1 AND entity_id=$2 ORDER BY created_at DESC LIMIT 50", [entityType, key])).rows;
    return NextResponse.json({ revisions: rows.map((row) => ({ ...row, created_at: row.created_at.toISOString() })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503 });
  }
}
