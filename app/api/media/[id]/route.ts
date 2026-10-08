import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { readPrivateMedia } from "@/lib/server/media/storage";
import { safeErrorMessage } from "@/lib/server/security";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Image was not found." }, { status: 404 });
  try {
    const row = (await query<{ derivative_key: string }>(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(m.derivatives,'$.preview')) AS derivative_key FROM media m
       WHERE m.id=$1 AND m.archived_at IS NULL AND m.processing_state='ready'
       AND EXISTS (SELECT 1 FROM projects p WHERE p.status='published' AND JSON_UNQUOTE(JSON_EXTRACT(p.published,'$.image'))=$2)`,
      [id,`media:${id}`],
    )).rows[0];
    if (!row?.derivative_key) return NextResponse.json({ error: "Image was not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const bytes = await readPrivateMedia(row.derivative_key);
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "image/webp", "Content-Length": String(bytes.length), "Cache-Control": "public, max-age=300, stale-while-revalidate=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (error) { return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
