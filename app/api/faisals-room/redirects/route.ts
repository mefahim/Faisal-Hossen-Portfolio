import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import {
  createRedirect,
  deleteRedirect,
  listRedirects,
  updateRedirect,
} from "@/lib/server/content/redirects";
import { correlationId, readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { z } from "zod";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

export async function GET() {
  try {
    await requireOwner();
    const rules = await listRedirects();
    return NextResponse.json({ rules, planning_only: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503 });
  }
}

const ruleBodySchema = z.object({
  source_path: z.string().min(1).max(500),
  target_url: z.string().min(1).max(2000),
  status_code: z.number().int(),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    const parsed = ruleBodySchema.safeParse(await readJsonBody(request, 16_000));
    if (!parsed.success) return NextResponse.json({ error: "Request body is invalid." }, { status: 400 });
    const { source_path, target_url, status_code } = parsed.data;
    // Update if exists, else create.
    const existing = (await listRedirects()).some((r) => r.source_path === source_path);
    const rule = existing
      ? await updateRedirect(source_path, target_url, status_code, owner.userId)
      : await createRedirect(source_path, target_url, status_code, owner.userId);
    return NextResponse.json(
      { rule, message: existing ? "Redirect rule updated (planning-only)." : "Redirect rule created (planning-only)." },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const message = error instanceof Error ? error.message : safeErrorMessage(error);
    const status = /already exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message, requestId }, { status });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    const source_path = new URL(request.url).searchParams.get("source_path") ?? "";
    await deleteRedirect(source_path, owner.userId);
    return NextResponse.json({ message: "Redirect rule deleted." }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const message = error instanceof Error && /not found/i.test(error.message) ? error.message : safeErrorMessage(error);
    return NextResponse.json({ error: message, requestId }, { status: 400 });
  }
}
