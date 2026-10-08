import argon2 from "argon2";
import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { checkLoginThrottle, clearLoginFailures, recordLoginFailure, startOwnerSession, verifyPassword } from "@/lib/server/auth";
import { recordActivity } from "@/lib/server/audit";
import { correlationId, RequestBodyError, readJsonBody, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { loginSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
const dummyHash = argon2.hash("not-a-real-owner-password-used-only-for-timing");

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const body = loginSchema.safeParse(await readJsonBody(request, 8_000));
    if (!body.success) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    const { email, password } = body.data;
    const throttle = await checkLoginThrottle(email, request);
    if (!throttle.allowed) return NextResponse.json({ error: "Email or password is incorrect. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(throttle.retrySeconds) } });
    const result = await query<{ id: string; password_hash: string }>("SELECT id,password_hash FROM users WHERE email=$1 AND is_active=true LIMIT 1", [email]);
    const user = result.rows[0];
    const hash = user?.password_hash ?? await dummyHash;
    const verified = await verifyPassword(hash, password);
    if (!user || !verified) {
      await recordLoginFailure(email, request);
      await recordActivity({ action: "auth.login_failed", entityType: "session", metadata: { outcome: "denied" }, requestId });
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    await clearLoginFailures(email, request);
    await startOwnerSession(user.id, request.headers.get("user-agent"));
    await recordActivity({ actorId: user.id, action: "auth.login_succeeded", entityType: "session", requestId });
    return NextResponse.json({ message: "Signed in." }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(`[${requestId}] Faisal's Room login failed: ${safeErrorMessage(error)}`);
    return NextResponse.json({ error: safeErrorMessage(error), requestId }, { status: 503 });
  }
}
