import { createHash } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { query, transaction } from "@/lib/server/db";
import { createMediaKey, deletePrivateMedia, writePrivateMedia } from "@/lib/server/media/storage";
import { correlationId, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { mediaMetadataSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const mimeByFormat: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };
const extensionByFormat: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp", avif: "avif" };

export async function GET() {
  try {
    await requireOwner();
    const result = await query(
      `SELECT m.id,m.storage_key,m.mime_type,m.byte_size,m.width,m.height,m.checksum_sha256,m.alt_text,m.focal_x,m.focal_y,m.derivatives,m.processing_state,m.archived_at,m.created_at,
        ((SELECT count(*) FROM project_media pm WHERE pm.media_id=m.id) +
         (SELECT count(*) FROM projects p WHERE p.draft->>'image'='media:'||m.id::text OR p.published->>'image'='media:'||m.id::text))::int AS usage_count
       FROM media m ORDER BY m.archived_at NULLS FIRST,m.created_at DESC LIMIT 500`,
    );
    return NextResponse.json({ media: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  let keys: string[] = [];
  try {
    const owner = await requireOwner();
    const length = Number(request.headers.get("content-length") ?? 0);
    if (!length || length > MAX_BYTES + 64_000) return NextResponse.json({ error: "Upload must include a content length and be no larger than 10 MB." }, { status: length > MAX_BYTES + 64_000 ? 413 : 411 });
    const form = await request.formData();
    const file = form.get("file");
    const metadata = mediaMetadataSchema.safeParse({ altText: form.get("altText"), focalX: form.get("focalX") ?? 0.5, focalY: form.get("focalY") ?? 0.5 });
    if (!(file instanceof File) || !metadata.success) return NextResponse.json({ error: "Choose an image and provide descriptive alt text." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be between 1 byte and 10 MB." }, { status: 413 });
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { failOn: "error", limitInputPixels: MAX_PIXELS, sequentialRead: true });
    const info = await image.metadata();
    if (!info.format || !mimeByFormat[info.format] || !info.width || !info.height || info.width * info.height > MAX_PIXELS) return NextResponse.json({ error: "Only valid JPEG, PNG, WebP, and AVIF images are accepted." }, { status: 415 });
    const main = await sharp(input, { failOn: "error", limitInputPixels: MAX_PIXELS }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, effort: 4 }).toBuffer();
    const thumbnail = await sharp(input, { failOn: "error", limitInputPixels: MAX_PIXELS }).rotate().resize({ width: 480, height: 360, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer();
    const id = crypto.randomUUID();
    const originalKey = await createMediaKey(extensionByFormat[info.format]);
    const derivativeKeys = { preview: `derivatives/${id}-preview.webp`, thumbnail: `derivatives/${id}-thumbnail.webp` };
    keys = [originalKey, derivativeKeys.preview, derivativeKeys.thumbnail];
    await Promise.all([writePrivateMedia(originalKey, input), writePrivateMedia(derivativeKeys.preview, main), writePrivateMedia(derivativeKeys.thumbnail, thumbnail)]);
    const checksum = createHash("sha256").update(input).digest("hex");
    const mediaRow = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO media(id,storage_key,mime_type,byte_size,width,height,checksum_sha256,alt_text,focal_x,focal_y,derivatives,processing_state)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'ready') RETURNING id`,
        [id, originalKey, mimeByFormat[info.format], input.length, info.width, info.height, checksum, metadata.data.altText, metadata.data.focalX, metadata.data.focalY, JSON.stringify({ preview: derivativeKeys.preview, thumbnail: derivativeKeys.thumbnail, outputMime: "image/webp" })],
      );
      await client.query("INSERT INTO activity_logs(actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES($1,'media.uploaded','media',$2,$3::jsonb,$4)", [owner.userId, id, JSON.stringify({ mime: mimeByFormat[info.format], bytes: input.length }), requestId]);
      return inserted.rows[0];
    });
    return NextResponse.json({ id: mediaRow.id, message: "Image uploaded, validated, and stored privately." }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    await Promise.all(keys.map((key) => deletePrivateMedia(key).catch(() => undefined)));
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const malformed = error instanceof Error && /Input buffer|unsupported image|pixel|format/i.test(error.message);
    return NextResponse.json({ error: malformed ? "The uploaded file is not a supported, valid image." : safeErrorMessage(error), requestId }, { status: malformed ? 415 : 503 });
  }
}
