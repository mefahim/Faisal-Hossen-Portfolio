import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { previewRedirect } from "@/lib/server/content/redirects";
import { safeErrorMessage } from "@/lib/server/security";

export const runtime = "nodejs";

/**
 * Planning-only redirect simulation.
 *
 * ALWAYS returns HTTP 200 with JSON. Never issues an HTTP 3xx redirect
 * and never sets a Location header, under any circumstance.
 */
export async function GET(request: Request) {
  try {
    await requireOwner();
    const path = new URL(request.url).searchParams.get("path") ?? "";
    const preview = await previewRedirect(path);
    const response = NextResponse.json(preview, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
    // Defense in depth: ensure no Location header can leak through.
    response.headers.delete("location");
    return response;
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 });
  }
}
