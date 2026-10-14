import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { importRedirectsCsv } from "@/lib/server/content/redirects";
import { correlationId, readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { z } from "zod";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" } as const;

const importBodySchema = z.object({
  csv: z.string().min(1).max(262_144), // 256 KB limit
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    const parsed = importBodySchema.safeParse(await readJsonBody(request, 270_000));
    if (!parsed.success) return NextResponse.json({ error: "Request body must be JSON { csv: string } (max 256 KB)." }, { status: 400 });
    const result = await importRedirectsCsv(parsed.data.csv, owner.userId);
    return NextResponse.json(
      {
        ...result,
        message: `${result.imported} rule(s) imported (planning-only). ${result.rejected.length} row(s) rejected.`,
        planning_only: true,
      },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error), requestId }, { status: 400 });
  }
}
