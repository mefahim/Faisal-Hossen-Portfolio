import "server-only";

/**
 * Phase 2 — Lead Inbox: query building for the leads list.
 *
 * Pure functions (testable without DB). The route layer handles auth.
 */

export const LEAD_STATUSES = ["new", "reviewing", "qualified", "won", "archived"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type LeadsListParams = {
  q: string;
  status: LeadStatus | "";
  page: number;
  limit: number;
};

export function isValidLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

/**
 * Parse and sanitize list query params. Never throws — falls back to defaults.
 */
export function parseLeadsParams(searchParams: URLSearchParams): LeadsListParams {
  const rawQ = searchParams.get("q") ?? "";
  const q = rawQ.trim().slice(0, 100);

  const rawStatus = searchParams.get("status") ?? "";
  const status: LeadStatus | "" = isValidLeadStatus(rawStatus) ? rawStatus : "";

  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(rawPage, 10_000) : 1;

  const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 20;

  return { q, status, page, limit };
}

export type LeadsQuery = {
  whereClause: string;
  countSql: string;
  listSql: string;
  params: unknown[];
};

/**
 * Build parameterized SQL for filtered/paginated lead listing.
 * All user input goes through placeholders — no string interpolation of values.
 */
export function buildLeadsQuery(params: LeadsListParams): LeadsQuery {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.status) {
    conditions.push(`status = $${idx++}`);
    values.push(params.status);
  }
  if (params.q) {
    // Escape LIKE wildcards so the search is literal, then wrap for substring match.
    const escaped = params.q.replace(/[\\%_]/g, (c) => `\\${c}`);
    conditions.push(
      `(name ILIKE $${idx} ESCAPE '\\' OR email ILIKE $${idx} ESCAPE '\\' OR company ILIKE $${idx} ESCAPE '\\' OR subject ILIKE $${idx} ESCAPE '\\' OR message ILIKE $${idx} ESCAPE '\\')`,
    );
    values.push(`%${escaped}%`);
    idx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (params.page - 1) * params.limit;

  const columns =
    "id,name,email,company,subject,message,status,delivery_status,created_at,updated_at";
  return {
    whereClause,
    countSql: `SELECT COUNT(*)::int AS total FROM contact_submissions ${whereClause}`,
    listSql:
      `SELECT ${columns} FROM contact_submissions ${whereClause} ` +
      `ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    params: [...values, params.limit, offset],
  };
}
