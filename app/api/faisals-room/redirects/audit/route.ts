import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { getRedirectAudit } from "@/lib/server/content/redirects";
import { safeErrorMessage } from "@/lib/server/security";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

export async function GET(request: Request) {
  try {
    await requireOwner();
    const redirectId = new URL(request.url).searchParams.get("redirect_id") ?? undefined;
    const entries = await getRedirectAudit(redirectId);
    return NextResponse.json({ audit: entries }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503 });
  }
}
