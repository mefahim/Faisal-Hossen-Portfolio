import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { publishContent } from "@/lib/server/content/repository";
import { query } from "@/lib/server/db";
import { correlationId, readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { publishSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    const body = publishSchema.safeParse(await readJsonBody(request, 8_000));
    if (!body.success) return NextResponse.json({ error: "Select a valid content record to publish." }, { status: 400 });
    await publishContent(body.data.kind, body.data.key, owner.userId, requestId);
    const pageRoute = body.data.kind === "pages" ? (await query<{ route: string }>("SELECT route FROM pages WHERE `key`=$1", [body.data.key])).rows[0]?.route : undefined;
    const paths = body.data.kind === "settings" ? ["/", "/work", "/about", "/contact"] : body.data.kind === "projects" ? ["/", "/work", `/work/${body.data.key}`] : body.data.kind === "pages" ? [pageRoute ?? "/"] : body.data.kind === "seo" ? [body.data.key] : ["/", "/work", "/about", "/contact"];
    for (const path of paths) if (typeof path === "string" && path.startsWith("/")) revalidatePath(path);
    revalidatePath("/sitemap.xml");
    return NextResponse.json({ message: "Published as a new revision. Public cache has been revalidated." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error && !error.message.startsWith("Database") ? error.message : safeErrorMessage(error), requestId }, { status: 400 });
  }
}
