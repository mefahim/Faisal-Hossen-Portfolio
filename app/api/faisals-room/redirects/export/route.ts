import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { exportRedirectsCsv, listRedirects } from "@/lib/server/content/redirects";
import { safeErrorMessage } from "@/lib/server/security";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireOwner();
    const rules = await listRedirects();
    const csv = exportRedirectsCsv(rules);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="redirects.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503 });
  }
}
