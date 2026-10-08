import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { readPrivateMedia } from "@/lib/server/media/storage";
import { readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;
    const row = (await query<{ storage_key: string; mime_type: string; derivatives: Record<string, string> }>("SELECT storage_key,mime_type,derivatives FROM media WHERE id=$1 AND archived_at IS NULL AND processing_state='ready'", [id])).rows[0];
    if (!row) return NextResponse.json({ error: "Image was not found." }, { status: 404 });
    const variant = new URL(request.url).searchParams.get("variant") ?? "preview";
    const fileKey = variant === "original" ? row.storage_key : variant === "thumbnail" ? row.derivatives.thumbnail : row.derivatives.preview;
    if (!fileKey || typeof fileKey !== "string") return NextResponse.json({ error: "Image derivative was not found." }, { status: 404 });
    const bytes = await readPrivateMedia(fileKey);
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": variant === "original" ? row.mime_type : "image/webp", "Content-Length": String(bytes.length), "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503 });
  }
}
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    const owner = await requireOwner();
    const body = await readJsonBody(request, 8_000) as { altText?: unknown; focalX?: unknown; focalY?: unknown };
    if (typeof body.altText !== "string" || body.altText.trim().length < 3 || body.altText.length > 500) return NextResponse.json({ error: "Alt text must be between 3 and 500 characters." }, { status: 400 });
    const x = Number(body.focalX ?? 0.5), y = Number(body.focalY ?? 0.5);
    if (![x,y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) return NextResponse.json({ error: "Focal point must be between 0 and 1." }, { status: 400 });
    const result = await query("UPDATE media SET alt_text=$1,focal_x=$2,focal_y=$3 WHERE id=$4 AND archived_at IS NULL", [body.altText.trim(), x, y, id]);
    if (!result.rowCount) return NextResponse.json({ error: "Image was not found." }, { status: 404 });
    await query("INSERT INTO activity_logs(id,actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES($1,$2,'media.metadata_updated','media',$3,'{}',$4)", [randomUUID(), owner.userId,id,randomUUID()]);
    return NextResponse.json({ message: "Image metadata updated." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503 });
  }
}
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    const owner = await requireOwner();
    const usage = await query<{ count: number; storage_key: string; derivatives: Record<string, string> }>("SELECT ((SELECT count(*) FROM project_media pm WHERE pm.media_id=m.id)+(SELECT count(*) FROM projects p WHERE JSON_UNQUOTE(JSON_EXTRACT(p.draft,'$.image'))=$2 OR JSON_UNQUOTE(JSON_EXTRACT(p.published,'$.image'))=$2)) AS count,m.storage_key,m.derivatives FROM media m WHERE m.id=$1", [id,`media:${id}`]);
    const row = usage.rows[0];
    if (!row) return NextResponse.json({ error: "Image was not found." }, { status: 404 });
    if (row.count > 0) return NextResponse.json({ error: "This image is still in use. Remove its project references before archiving it." }, { status: 409 });
    await query("UPDATE media SET archived_at=now() WHERE id=$1 AND archived_at IS NULL", [id]);
    await query("INSERT INTO activity_logs(id,actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES($1,$2,'media.archived','media',$3,'{}',$4)", [randomUUID(), owner.userId,id,randomUUID()]);
    return NextResponse.json({ message: "Image archived. Stored files were retained for recovery." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503 });
  }
}
