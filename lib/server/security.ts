import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { assertSecuritySecret } from "./config";

export class RequestBodyError extends Error {
  constructor(readonly status: 400 | 413, message: string) { super(message); this.name = "RequestBodyError"; }
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";",1)[0].trim().toLowerCase() !== "application/json") throw new RequestBodyError(400, "Content-Type must be application/json.");
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) throw new RequestBodyError(413, "Request body is too large.");
  if (!request.body) throw new RequestBodyError(400, "Request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError(413, "Request body is too large.");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400, "Request body is invalid.");
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))));
  } catch { throw new RequestBodyError(400, "Request body is invalid JSON."); }
}

export function correlationId(request: Request): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[a-zA-Z0-9._-]{8,80}$/.test(supplied) ? supplied : randomUUID();
}

export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function privateKey(value: string): string {
  return createHmac("sha256", assertSecuritySecret()).update(value).digest("hex");
}

export function sameOrigin(request: Request): boolean {
  const requestUrl = new URL(request.url);
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const expectedOrigins = new Set<string>();
  if (configuredOrigin) {
    try { expectedOrigins.add(new URL(configuredOrigin).origin); } catch { return false; }
  } else {
    expectedOrigins.add(requestUrl.origin);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost || request.headers.get("host");
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto ? `${forwardedProto}:` : requestUrl.protocol;
    if (host) {
      try { expectedOrigins.add(new URL(`${protocol}//${host}`).origin); } catch { return false; }
    }
  }
  const origin = request.headers.get("origin");
  if (origin) {
    try { return expectedOrigins.has(new URL(origin).origin); } catch { return false; }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try { return expectedOrigins.has(new URL(referer).origin); } catch { return false; }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("Database is not configured")) return "This feature is not configured yet.";
  return "The request could not be completed. Please try again.";
}
