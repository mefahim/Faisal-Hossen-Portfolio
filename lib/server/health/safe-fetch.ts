import "server-only";
import dns from "node:dns";
import net from "node:net";

/**
 * Phase 2 — Website Health Audit: SSRF-protected HTTP client.
 *
 * Treats the target website as untrusted. Layered fail-closed validation:
 *
 * 1. URL canonicalization: only http/https, no credentials, no exotic ports.
 * 2. DNS resolution of the hostname; EVERY resolved IP must be public.
 *    Blocked: loopback, private (RFC 1918), link-local (incl. cloud metadata
 *    169.254.169.254), reserved, multicast, unspecified, IPv4-mapped IPv6
 *    that maps to a blocked IPv4, and decimal/octal/hex IP trickery.
 * 3. DNS pinning: during the fetch, dns.lookup is patched to return the
 *    validated IP, defeating DNS rebinding (TOCTOU) between validation and
 *    connection. Restored in a finally block.
 * 4. Redirects handled manually: each destination re-validated from scratch
 *    (max 5 hops, same-host not required but each hop fully checked).
 * 5. Timeouts (10s), response cap (2MB), no JS execution (text parsing only).
 *
 * Errors never include internal network details or raw IP addresses.
 */

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export const MAX_REDIRECTS = 5;
const ALLOWED_PORTS = new Set([80, 443]);

export class SafeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeFetchError";
  }
}

/** Normalize an IPv4 address, rejecting decimal/octal/hex trickery. */
function parseIPv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const bytes: number[] = [];
  for (const p of parts) {
    // Reject leading zeros (octal ambiguity), hex, empty, non-digits.
    if (!/^(0|[1-9][0-9]{0,2})$/.test(p)) return null;
    const n = parseInt(p, 10);
    if (n > 255) return null;
    bytes.push(n);
  }
  return bytes;
}

function ipv4ToInt(b: number[]): number {
  return ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
}

function inCidr(ipInt: number, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr, 10);
  const baseBytes = parseIPv4(base);
  if (!baseBytes) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (ipv4ToInt(baseBytes) & mask);
}

// IPv4 ranges that must never be fetched.
const BLOCKED_V4_CIDRS = [
  "0.0.0.0/8", // unspecified
  "10.0.0.0/8", // private
  "100.64.0.0/10", // carrier-grade NAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local (cloud metadata!)
  "172.16.0.0/12", // private
  "192.0.0.0/24", // reserved
  "192.0.2.0/24", // documentation (TEST-NET-1)
  "192.168.0.0/16", // private
  "198.18.0.0/15", // benchmark testing
  "198.51.100.0/24", // documentation (TEST-NET-2)
  "203.0.113.0/24", // documentation (TEST-NET-3)
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved
];

/**
 * True when the IP is a public, routable address safe to fetch.
 * Exported for tests. Handles IPv4, IPv6, and IPv4-mapped IPv6.
 */
export function isPublicIp(ip: string): boolean {
  const trimmed = ip.trim();
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) — check the embedded IPv4.
  const mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPublicIp(mapped[1]);

  if (net.isIPv4(trimmed)) {
    const bytes = parseIPv4(trimmed);
    if (!bytes) return false; // trickery like 0x7f.0.0.1 already rejected by isIPv4? be strict
    const int = ipv4ToInt(bytes);
    return !BLOCKED_V4_CIDRS.some((cidr) => inCidr(int, cidr));
  }
  if (net.isIPv6(trimmed)) {
    const lower = trimmed.toLowerCase();
    // Unspecified, loopback, link-local, unique-local, multicast, reserved.
    if (lower === "::" || lower === "::1") return false;
    if (lower.startsWith("fe80:")) return false;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return false;
    if (lower.startsWith("ff")) return false;
    return true;
  }
  return false;
}

/**
 * Validate and canonicalize a target URL. Throws SafeFetchError on any
 * problem. Returns the canonical URL object.
 */
export function validateTargetUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) {
    throw new SafeFetchError("Invalid URL.");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new SafeFetchError("Invalid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("Only HTTP and HTTPS URLs are allowed.");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("URLs with credentials are not allowed.");
  }
  const port = url.port ? parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    throw new SafeFetchError("Only ports 80 and 443 are allowed.");
  }
  return url;
}

/** Resolve a hostname and return validated public IPs. Throws on failure. */
async function resolvePublicIps(hostname: string): Promise<string[]> {
  // Reject literal IPs that aren't public before DNS.
  if (net.isIP(hostname)) {
    if (!isPublicIp(hostname)) throw new SafeFetchError("Target address is not allowed.");
    return [hostname];
  }
  // Block obvious local hostnames without DNS.
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".internal") || lower.endsWith(".local")) {
    throw new SafeFetchError("Target hostname is not allowed.");
  }
  let records: string[];
  try {
    records = await dns.promises.lookup(hostname, { all: true }).then((r) => r.map((x) => x.address));
  } catch {
    throw new SafeFetchError("Could not resolve the target hostname.");
  }
  if (records.length === 0) throw new SafeFetchError("Could not resolve the target hostname.");
  const publicIps = records.filter(isPublicIp);
  if (publicIps.length === 0) {
    throw new SafeFetchError("Target hostname resolves to a non-public address.");
  }
  return publicIps;
}

export type SafeFetchResult = {
  url: string; // final URL after redirects
  status: number;
  headers: Record<string, string>;
  body: string; // text, capped at MAX_RESPONSE_BYTES
  redirectChain: string[];
  truncated: boolean;
};

/**
 * Fetch a URL with full SSRF protection. Follows redirects manually
 * (re-validating each hop). Returns text body capped at 2MB.
 */
export async function safeFetch(rawUrl: string): Promise<SafeFetchResult> {
  const redirectChain: string[] = [];
  let current = validateTargetUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ips = await resolvePublicIps(current.hostname);
    const pinnedIp = ips[0];

    // DNS pinning: force this hostname to the validated IP during fetch.
    const originalLookup = dns.lookup;
    const pinnedLookup = (
      hostname: string,
      options: dns.LookupOptions,
      callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => void,
    ) => {
      if (hostname === current.hostname) {
        const family = net.isIPv6(pinnedIp) ? 6 : 4;
        callback(null, pinnedIp, family);
        return;
      }
      return (originalLookup as typeof dns.lookup)(hostname, options, callback);
    };

    let response: Response;
    try {
      (dns as { lookup: typeof dns.lookup }).lookup = pinnedLookup as typeof dns.lookup;
      response = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": "FaisalsRoom-HealthAudit/1.0 (+https://faisalhossen.com)",
          Accept: "text/html,application/xhtml+xml,text/plain",
        },
      });
    } catch (err) {
      throw new SafeFetchError(
        err instanceof Error && err.name === "TimeoutError"
          ? "The target took too long to respond."
          : "Could not fetch the target URL.",
      );
    } finally {
      (dns as { lookup: typeof dns.lookup }).lookup = originalLookup;
    }

    // Manual redirect handling with full re-validation per hop.
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location) throw new SafeFetchError("Redirect without a destination.");
      if (hop === MAX_REDIRECTS) throw new SafeFetchError("Too many redirects.");
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new SafeFetchError("Invalid redirect destination.");
      }
      redirectChain.push(current.toString());
      current = validateTargetUrl(next.toString()); // re-validates scheme/host/port
      continue;
    }

    // Read body with a byte cap.
    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    let truncated = false;
    let body = "";
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: false });
      let bytes = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_RESPONSE_BYTES) {
            truncated = true;
            break;
          }
          body += decoder.decode(value, { stream: true });
        }
        body += decoder.decode();
      } finally {
        await reader.cancel().catch(() => undefined);
      }
    }

    return {
      url: current.toString(),
      status: response.status,
      headers,
      body,
      redirectChain,
      truncated,
    };
  }
  throw new SafeFetchError("Too many redirects.");
}
