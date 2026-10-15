import "server-only";
import { getValidAccessToken } from "./tokens";

/**
 * Phase 2 Feature 3 (Phase B Step 2, PR-B): GA4 property discovery.
 *
 * Lists GA4 properties accessible to the connected Google account via the
 * Google Analytics Admin API. Only the `analytics.readonly` scope is used.
 *
 * Security:
 * - Requires a valid (possibly refreshed) access token; never exposes tokens.
 * - Returns only property IDs and display names — no metrics, no PII.
 * - All network calls have timeouts.
 * - API errors are mapped to safe, generic messages.
 */

const ADMIN_API_BASE = "https://analyticsadmin.googleapis.com/v1beta";

export type GA4Property = {
  /** Numeric property ID (e.g. "123456789"). Validated format. */
  propertyId: string;
  /** Human-readable property name from Google. */
  displayName: string;
  /** Parent account display name, if available. */
  accountName: string;
};

type AccountSummaryResponse = {
  accountSummaries?: Array<{
    displayName?: string;
    propertySummaries?: Array<{
      property?: string;
      displayName?: string;
    }>;
  }>;
  nextPageToken?: string;
};

/**
 * Extract the numeric property ID from a resource name like "properties/123456789".
 * Returns null for malformed names (never trust API output blindly).
 */
export function parsePropertyId(resourceName: string): string | null {
  const match = /^properties\/(\d+)$/.exec(resourceName);
  return match ? match[1] : null;
}

/**
 * List all GA4 properties accessible to the connected account.
 * Handles pagination. Throws on API errors with safe messages.
 */
export async function listGA4Properties(provider: string, actorId: string): Promise<GA4Property[]> {
  const accessToken = await getValidAccessToken(provider, actorId);
  const properties: GA4Property[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${ADMIN_API_BASE}/accountSummaries`);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error("Could not reach Google Analytics API.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("Google authorization failed. Reconnect your account.");
    }
    if (!response.ok) {
      throw new Error("Could not list GA4 properties. Please try again.");
    }

    const data = (await response.json()) as AccountSummaryResponse;
    for (const account of data.accountSummaries ?? []) {
      const accountName = typeof account.displayName === "string" ? account.displayName : "";
      for (const prop of account.propertySummaries ?? []) {
        const propertyId = typeof prop.property === "string" ? parsePropertyId(prop.property) : null;
        if (!propertyId) continue; // Skip malformed entries
        properties.push({
          propertyId,
          displayName: typeof prop.displayName === "string" ? prop.displayName : propertyId,
          accountName,
        });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return properties;
}
