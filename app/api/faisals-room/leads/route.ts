import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { query, transaction } from "@/lib/server/db";
import { correlationId, readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { leadStatusSchema } from "@/lib/server/validation";
import { buildLeadsQuery, parseLeadsParams } from "@/lib/server/leads";

export const runtime = "nodejs";
/**
 * List leads with search, status filter, and pagination.
 *
 * Query params: q (search), status (new|reviewing|qualified|won|archived),
 * page (1-based), limit (default 20, max 100).
 * Owner-only. No PII in logs.
 */
export async function GET(request: Request) {
  try {
    await requireOwner();
    const params = parseLeadsParams(new URL(request.url).searchParams);
    const { countSql, listSql, params: values } = buildLeadsQuery(params);
    const [countRes, listRes] = await Promise.all([
      query<{ total: number }>(countSql, values.slice(0, values.length - 2)),
      query(listSql, values),
    ]);
    const total = countRes.rows[0]?.total ?? 0;
    return NextResponse.json(
      {
        leads: listRes.rows,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503 });
  }
}
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const owner = await requireOwner();
    const body = leadStatusSchema.safeParse(await readJsonBody(request, 8_000));
    if (!body.success) return NextResponse.json({ error: "Select a valid lead status." }, { status: 400 });
    await transaction(async (client) => {
      const updated = await client.query("UPDATE contact_submissions SET status=$1,updated_at=now() WHERE id=$2", [body.data.status,body.data.id]);
      if (!updated.rowCount) throw new Error("Lead was not found.");
      await client.query("INSERT INTO activity_logs(id,actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES($1,$2,'lead.status_changed','lead',$3,$4,$5)", [randomUUID(), owner.userId,body.data.id,JSON.stringify({ status: body.data.status }),requestId]);
    });
    return NextResponse.json({ message: "Lead status updated." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error && error.message === "Lead was not found." ? error.message : safeErrorMessage(error), requestId }, { status: 400 });
  }
}
