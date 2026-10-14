import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { revertRedirect } from "@/lib/server/content/redirects";
import { correlationId, readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { z } from "zod";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

const revertBodySchema = z.object({
  audit_id: z.string().uuid(),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    const parsed = revertBodySchema.safeParse(await readJsonBody(request, 8_000));
    if (!parsed.success) return NextResponse.json({ error: "Request body must be JSON { audit_id: uuid }." }, { status: 400 });
    const rule = await revertRedirect(parsed.data.audit_id, owner.userId);
    return NextResponse.json(
      { rule, message: "Redirect rule reverted to prior state (planning-only)." },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error), requestId }, { status: 400 });
  }
}
