import { NextResponse } from "next/server";
import { transaction } from "@/lib/server/db";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { clientAddress, correlationId, readJsonBody, RequestBodyError, safeErrorMessage, sameOrigin } from "@/lib/server/security";
import { contactSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const requestId = correlationId(request);
  try {
    const input = contactSchema.safeParse(await readJsonBody(request, 12_000));
    if (!input.success) return NextResponse.json({ error: "Please check the form fields and try again." }, { status: 400 });
    if (input.data.website) return NextResponse.json({ message: "Thanks — your message has been received." }, { status: 202, headers: { "Cache-Control": "no-store" } });
    const limit = await consumeRateLimit(`contact:${clientAddress(request)}`, 5, 60 * 60);
    if (!limit.allowed) return NextResponse.json({ error: "Too many messages were submitted. Please try again later." }, { status: 429, headers: { "Retry-After": String(limit.retrySeconds) } });

    const lead = await transaction(async (client) => {
      const result = await client.query<{ id: string }>(
        "INSERT INTO contact_submissions(name,email,company,subject,message,delivery_status) VALUES($1,$2,$3,$4,$5,'pending') RETURNING id",
        [input.data.name, input.data.email, input.data.company, input.data.subject, input.data.message],
      );
      const id = result.rows[0].id;
      await client.query("INSERT INTO activity_logs(actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES(NULL,'contact.stored','lead',$1,'{}'::jsonb,$2)", [id, requestId]);
      return id;
    });

    const config = process.env;
    let deliveryStatus: "sent" | "failed" | "not_configured" | "pending" = "not_configured";
    let deliveryErrorCode: string | null = null;
    if (config.RESEND_API_KEY && config.CONTACT_EMAIL && config.CONTACT_FROM_EMAIL) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: config.CONTACT_FROM_EMAIL,
            to: [config.CONTACT_EMAIL],
            reply_to: input.data.email,
            subject: `Portfolio enquiry: ${input.data.subject}`,
            text: [`Name: ${input.data.name}`, `Email: ${input.data.email}`, `Company / Website: ${input.data.company || "Not provided"}`, "", input.data.message].join("\n"),
          }),
          signal: AbortSignal.timeout(10_000),
        });
        deliveryStatus = response.ok ? "sent" : "failed";
        if (!response.ok) deliveryErrorCode = "provider_rejected";
      } catch { deliveryStatus = "failed"; deliveryErrorCode = "provider_unavailable"; }
    }
    try {
      await transaction(async (client) => {
        await client.query("UPDATE contact_submissions SET delivery_status=$1,delivery_error_code=$2,updated_at=now() WHERE id=$3", [deliveryStatus, deliveryErrorCode, lead]);
        await client.query("INSERT INTO activity_logs(actor_id,action,entity_type,entity_id,safe_metadata,correlation_id) VALUES(NULL,'contact.delivery_updated','lead',$1,$2::jsonb,$3)", [lead, JSON.stringify({ status: deliveryStatus }), requestId]);
      });
    } catch {
      console.error(`[${requestId}] Lead was durably stored; optional delivery status could not be updated.`);
      deliveryStatus = "pending";
    }
    const message = deliveryStatus === "sent" ? "Thanks — your message has been saved and the email notification was sent." : deliveryStatus === "failed" ? "Thanks — your message was saved, but the email notification could not be delivered. The site owner can still review it." : deliveryStatus === "pending" ? "Thanks — your message was saved. The email notification status is still pending." : "Thanks — your message was saved. Email notification is not configured yet.";
    return NextResponse.json({ message, stored: true, deliveryStatus }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(`[${requestId}] Contact submission failed: ${safeErrorMessage(error)}`);
    return NextResponse.json({ error: safeErrorMessage(error), requestId }, { status: 503 });
  }
}
