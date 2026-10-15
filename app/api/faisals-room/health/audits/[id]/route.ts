import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { getAudit } from "@/lib/server/health/audit";
import { safeErrorMessage } from "@/lib/server/security";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Phase 2 — Website Health Audit: get a single audit with its findings.
 *
 * GET, owner-only. The id is a UUID validated by getAudit; unknown ids
 * return 404 without leaking anything.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
    const { id } = await params;
    const audit = await getAudit(id);
    if (!audit) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404, headers: noStore });
    }
    return NextResponse.json({ audit }, { headers: noStore });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    }
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503, headers: noStore });
  }
}
