import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireOwner, UnauthorizedError } from "../auth";
import { transaction, query, type DbClient } from "../db";

/**
 * Phase 2 Feature 2: Redirect Manager (planning-only).
 *
 * Redirect rules are stored as drafts. No middleware or public route handler
 * evaluates the `redirects` table. The `is_active` column is ignored by all
 * public request handling throughout Phase 2.
 */

// --- Validation schemas ---

const sourcePathSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^\/(?!\/)[a-zA-Z0-9/_.-]*$/, "Source path must be a root-relative path.")
  .refine((v) => !/^\/(?:faisals-room|api)(\/|$)/i.test(v), "Redirects cannot target /faisals-room/* or /api/*.")
  .refine((v) => !/%(?![0-9A-Fa-f]{2})/.test(v), "Source path contains invalid percent-encoding.");

const targetUrlSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine((v) => {
    if (v.startsWith("/")) {
      return /^\/(?!\/)[a-zA-Z0-9/_.-]*$/.test(v) && !/%(?![0-9A-Fa-f]{2})/.test(v);
    }
    try {
      const url = new URL(v);
      return url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Target must be a root-relative path or an absolute https:// URL.");

const statusCodeSchema = z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]);

export const redirectRuleSchema = z.object({
  source_path: sourcePathSchema,
  target_url: targetUrlSchema,
  status_code: statusCodeSchema,
  is_active: z.boolean().default(false),
});

export type RedirectRule = {
  id: string;
  source_path: string;
  target_url: string;
  status_code: 301 | 302 | 307 | 308;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type RedirectAuditEntry = {
  id: string;
  redirect_id: string | null;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  actor_id: string;
  created_at: string;
};

// --- Normalization ---
// Normalization preserves meaning: trailing slashes, query strings,
// percent-encoding, and case are all significant and never altered silently.
// Only HTTPS hostnames are lowercased (per RFC 4343); everything else is kept verbatim.

export function normalizeTargetUrl(target: string): string {
  if (target.startsWith("/")) return target;
  try {
    const url = new URL(target);
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return target;
  }
}

function validateRuleInput(source_path: string, target_url: string, status_code: number): { source_path: string; target_url: string; status_code: 301 | 302 | 307 | 308 } {
  const parsed = redirectRuleSchema.safeParse({ source_path, target_url, status_code, is_active: false });
  if (!parsed.success) {
    throw new Error(`Redirect validation failed: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).slice(0, 5).join("; ")}`);
  }
  const normalizedTarget = normalizeTargetUrl(parsed.data.target_url);
  if (parsed.data.source_path === normalizedTarget) {
    throw new Error("Self-redirect rejected: source path and target URL are identical.");
  }
  return { source_path: parsed.data.source_path, target_url: normalizedTarget, status_code: parsed.data.status_code };
}

// --- Loop detection & chain depth ---
// Builds a directed graph of path->path edges from existing rules plus the
// proposed change. External (https://) targets terminate chains.

type RuleEdge = { source: string; target: string };

async function getAllRulesForGraph(): Promise<RuleEdge[]> {
  const rows = (await query<{ source_path: string; target_url: string }>("SELECT source_path, target_url FROM redirects")).rows;
  return rows.map((r) => ({ source: r.source_path, target: r.target_url }));
}

function isPathTarget(target: string): boolean {
  return target.startsWith("/");
}

export function detectCycle(edges: RuleEdge[]): string[] | null {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!isPathTarget(e.target)) continue;
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  const visit = (node: string): string[] | null => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      if (color.get(next) === GRAY) {
        const cycleStart = stack.indexOf(next);
        return [...stack.slice(cycleStart), next];
      }
      if ((color.get(next) ?? WHITE) === WHITE) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  };
  for (const node of adj.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      const found = visit(node);
      if (found) return found;
    }
  }
  return null;
}

export function checkChainDepth(edges: RuleEdge[], startSource: string, maxDepth = 5): { ok: boolean; chain: string[] } {
  const targetOf = new Map(edges.map((e) => [e.source, e.target]));
  const chain: string[] = [startSource];
  let current = startSource;
  for (let i = 0; i < maxDepth + 1; i++) {
    const nextTarget = targetOf.get(current);
    if (!nextTarget) return { ok: true, chain };
    chain.push(nextTarget);
    if (!isPathTarget(nextTarget)) return { ok: true, chain };
    if (chain.length > maxDepth + 1) return { ok: false, chain };
    current = nextTarget;
  }
  return { ok: chain.length <= maxDepth + 1, chain };
}

async function validateAgainstExisting(
  source_path: string,
  target_url: string,
  excludeSource?: string,
): Promise<void> {
  const edges = await getAllRulesForGraph();
  const filtered = excludeSource ? edges.filter((e) => e.source !== excludeSource) : edges;
  const proposed: RuleEdge[] = [...filtered, { source: source_path, target: target_url }];
  const cycle = detectCycle(proposed);
  if (cycle) {
    throw new Error(`Redirect cycle detected: ${cycle.join(" → ")}. Rule rejected.`);
  }
  const { ok, chain } = checkChainDepth(proposed, source_path);
  if (!ok) {
    throw new Error(`Redirect chain exceeds 5 hops: ${chain.join(" → ")}. Rule rejected.`);
  }
}

// --- Audit logging ---

async function writeAudit(
  client: DbClient,
  input: { redirect_id: string | null; action: string; old_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null; actor_id: string },
): Promise<void> {
  await client.query(
    "INSERT INTO redirect_audit(id, redirect_id, `action`, old_value, new_value, actor_id) VALUES($1,$2,$3,$4,$5,$6)",
    [
      randomUUID(),
      input.redirect_id,
      input.action,
      input.old_value ? JSON.stringify(input.old_value) : null,
      input.new_value ? JSON.stringify(input.new_value) : null,
      input.actor_id,
    ],
  );
}

// --- CRUD operations ---

export async function listRedirects(): Promise<RedirectRule[]> {
  const session = await requireOwner();
  void session;
  const rows = (
    await query<{ id: string; source_path: string; target_url: string; status_code: number; is_active: number; created_by: string; created_at: Date; updated_at: Date }>(
      "SELECT id, source_path, target_url, status_code, is_active, created_by, created_at, updated_at FROM redirects ORDER BY source_path",
    )
  ).rows;
  return rows.map((r) => ({
    id: r.id,
    source_path: r.source_path,
    target_url: r.target_url,
    status_code: r.status_code as 301 | 302 | 307 | 308,
    is_active: Boolean(r.is_active),
    created_by: r.created_by,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  }));
}

export async function createRedirect(
  source_path: string,
  target_url: string,
  status_code: number,
  actorId: string,
): Promise<RedirectRule> {
  const session = await requireOwner();
  if (session.userId !== actorId) throw new UnauthorizedError();
  const valid = validateRuleInput(source_path, target_url, status_code);
  await validateAgainstExisting(valid.source_path, valid.target_url);
  const id = randomUUID();
  try {
    await transaction(async (client) => {
      await client.query(
        "INSERT INTO redirects(id, source_path, target_url, status_code, is_active, created_by) VALUES($1,$2,$3,$4,FALSE,$5)",
        [id, valid.source_path, valid.target_url, valid.status_code, actorId],
      );
      await writeAudit(client, {
        redirect_id: id,
        action: "created",
        old_value: null,
        new_value: { source_path: valid.source_path, target_url: valid.target_url, status_code: valid.status_code },
        actor_id: actorId,
      });
    });
  } catch (error) {
    if (error instanceof Error && /duplicate/i.test(error.message)) {
      throw new Error(`A redirect for '${valid.source_path}' already exists. Edit or delete it first.`);
    }
    throw error;
  }
  const created = (await query<{ id: string; source_path: string; target_url: string; status_code: number; is_active: number; created_by: string; created_at: Date; updated_at: Date }>(
    "SELECT id, source_path, target_url, status_code, is_active, created_by, created_at, updated_at FROM redirects WHERE id=$1",
    [id],
  )).rows[0];
  return {
    id: created.id,
    source_path: created.source_path,
    target_url: created.target_url,
    status_code: created.status_code as 301 | 302 | 307 | 308,
    is_active: Boolean(created.is_active),
    created_by: created.created_by,
    created_at: created.created_at.toISOString(),
    updated_at: created.updated_at.toISOString(),
  };
}

export async function updateRedirect(
  source_path: string,
  target_url: string,
  status_code: number,
  actorId: string,
): Promise<RedirectRule> {
  const session = await requireOwner();
  if (session.userId !== actorId) throw new UnauthorizedError();
  const valid = validateRuleInput(source_path, target_url, status_code);
  await validateAgainstExisting(valid.source_path, valid.target_url, valid.source_path);
  return transaction(async (client) => {
    const existing = (await client.query<{ id: string; source_path: string; target_url: string; status_code: number; is_active: number }>(
      "SELECT id, source_path, target_url, status_code, is_active FROM redirects WHERE source_path=$1",
      [valid.source_path],
    )).rows[0];
    if (!existing) throw new Error(`No redirect found for '${valid.source_path}'.`);
    const oldValue = { source_path: existing.source_path, target_url: existing.target_url, status_code: existing.status_code, is_active: Boolean(existing.is_active) };
    await client.query("UPDATE redirects SET target_url=$1, status_code=$2, updated_at=now() WHERE source_path=$3", [
      valid.target_url,
      valid.status_code,
      valid.source_path,
    ]);
    await writeAudit(client, {
      redirect_id: existing.id,
      action: "updated",
      old_value: oldValue,
      new_value: { source_path: valid.source_path, target_url: valid.target_url, status_code: valid.status_code },
      actor_id: actorId,
    });
    const updated = (await client.query<{ id: string; source_path: string; target_url: string; status_code: number; is_active: number; created_by: string; created_at: Date; updated_at: Date }>(
      "SELECT id, source_path, target_url, status_code, is_active, created_by, created_at, updated_at FROM redirects WHERE source_path=$1",
      [valid.source_path],
    )).rows[0];
    return {
      id: updated.id,
      source_path: updated.source_path,
      target_url: updated.target_url,
      status_code: updated.status_code as 301 | 302 | 307 | 308,
      is_active: Boolean(updated.is_active),
      created_by: updated.created_by,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
    };
  });
}

export async function deleteRedirect(source_path: string, actorId: string): Promise<void> {
  const session = await requireOwner();
  if (session.userId !== actorId) throw new UnauthorizedError();
  await transaction(async (client) => {
    const existing = (await client.query<{ id: string; source_path: string; target_url: string; status_code: number }>(
      "SELECT id, source_path, target_url, status_code FROM redirects WHERE source_path=$1",
      [source_path],
    )).rows[0];
    if (!existing) throw new Error(`No redirect found for '${source_path}'.`);
    await client.query("DELETE FROM redirects WHERE source_path=$1", [source_path]);
    await writeAudit(client, {
      redirect_id: existing.id,
      action: "deleted",
      old_value: { source_path: existing.source_path, target_url: existing.target_url, status_code: existing.status_code },
      new_value: null,
      actor_id: actorId,
    });
  });
}

// --- Preview (planning-only simulation; never redirects) ---

export type RedirectPreview = {
  would_redirect: boolean;
  target: string | null;
  status_code: number | null;
  chain: string[];
  planning_only: true;
};

export async function previewRedirect(path: string): Promise<RedirectPreview> {
  const session = await requireOwner();
  void session;
  const edges = await getAllRulesForGraph();
  const targetOf = new Map(edges.map((e) => [e.source, e.target]));
  const statusOf = new Map(
    (await query<{ source_path: string; status_code: number }>("SELECT source_path, status_code FROM redirects")).rows.map((r) => [r.source_path, r.status_code]),
  );
  const chain: string[] = [path];
  let current: string | undefined = path;
  for (let i = 0; i < 6; i++) {
    const nextTarget: string | undefined = current ? targetOf.get(current) : undefined;
    if (!nextTarget) break;
    chain.push(nextTarget);
    if (!isPathTarget(nextTarget)) break;
    current = nextTarget;
  }
  const directTarget = targetOf.get(path);
  return {
    would_redirect: Boolean(directTarget),
    target: directTarget ?? null,
    status_code: directTarget ? (statusOf.get(path) ?? null) : null,
    chain,
    planning_only: true,
  };
}

// --- Audit history & revert ---

export async function getRedirectAudit(redirectId?: string, limit = 100): Promise<RedirectAuditEntry[]> {
  const session = await requireOwner();
  void session;
  const rows = redirectId
    ? (await query<{ id: string; redirect_id: string | null; action: string; old_value: string | Record<string, unknown> | null; new_value: string | Record<string, unknown> | null; actor_id: string; created_at: Date }>(
        "SELECT id, redirect_id, `action`, old_value, new_value, actor_id, created_at FROM redirect_audit WHERE redirect_id=$1 ORDER BY created_at DESC LIMIT $2",
        [redirectId, Math.min(limit, 500)],
      )).rows
    : (await query<{ id: string; redirect_id: string | null; action: string; old_value: string | Record<string, unknown> | null; new_value: string | Record<string, unknown> | null; actor_id: string; created_at: Date }>(
        "SELECT id, redirect_id, `action`, old_value, new_value, actor_id, created_at FROM redirect_audit ORDER BY created_at DESC LIMIT $1",
        [Math.min(limit, 500)],
      )).rows;
  return rows.map((r) => ({
    id: r.id,
    redirect_id: r.redirect_id,
    action: r.action,
    old_value: parseJsonColumn(r.old_value),
    new_value: parseJsonColumn(r.new_value),
    actor_id: r.actor_id,
    created_at: r.created_at.toISOString(),
  }));
}

// mysql2 automatically parses MySQL JSON columns into objects.
// Handle both string (defensive) and already-parsed object forms.
function parseJsonColumn(value: string | Record<string, unknown> | null): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return value as Record<string, unknown>;
}

export async function revertRedirect(auditId: string, actorId: string): Promise<RedirectRule> {
  const session = await requireOwner();
  if (session.userId !== actorId) throw new UnauthorizedError();
  return transaction(async (client) => {
    const entry = (await client.query<{ redirect_id: string | null; action: string; old_value: string | Record<string, unknown> | null }>(
      "SELECT redirect_id, `action`, old_value FROM redirect_audit WHERE id=$1",
      [auditId],
    )).rows[0];
    if (!entry || !entry.old_value || !entry.redirect_id) {
      throw new Error("This audit entry cannot be reverted (no prior state recorded).");
    }
    const prior = parseJsonColumn(entry.old_value) as unknown as { source_path: string; target_url: string; status_code: number };
    if (!prior || typeof prior.source_path !== "string") {
      throw new Error("This audit entry has an invalid prior state and cannot be reverted.");
    }
    // Validate the restored state BEFORE writing. Atomic failure if invalid.
    const valid = validateRuleInput(prior.source_path, prior.target_url, prior.status_code);
    await validateAgainstExisting(valid.source_path, valid.target_url, valid.source_path);
    const existing = (await client.query<{ id: string }>("SELECT id FROM redirects WHERE source_path=$1", [valid.source_path])).rows[0];
    if (!existing) throw new Error("The redirect no longer exists; cannot revert.");
    const current = (await client.query<{ source_path: string; target_url: string; status_code: number }>(
      "SELECT source_path, target_url, status_code FROM redirects WHERE id=$1",
      [existing.id],
    )).rows[0];
    await client.query("UPDATE redirects SET target_url=$1, status_code=$2, updated_at=now() WHERE id=$3", [
      valid.target_url,
      valid.status_code,
      existing.id,
    ]);
    await writeAudit(client, {
      redirect_id: existing.id,
      action: "reverted",
      old_value: { source_path: current.source_path, target_url: current.target_url, status_code: current.status_code },
      new_value: { source_path: valid.source_path, target_url: valid.target_url, status_code: valid.status_code, reverts_audit_id: auditId },
      actor_id: actorId,
    });
    const reverted = (await client.query<{ id: string; source_path: string; target_url: string; status_code: number; is_active: number; created_by: string; created_at: Date; updated_at: Date }>(
      "SELECT id, source_path, target_url, status_code, is_active, created_by, created_at, updated_at FROM redirects WHERE id=$1",
      [existing.id],
    )).rows[0];
    return {
      id: reverted.id,
      source_path: reverted.source_path,
      target_url: reverted.target_url,
      status_code: reverted.status_code as 301 | 302 | 307 | 308,
      is_active: Boolean(reverted.is_active),
      created_by: reverted.created_by,
      created_at: reverted.created_at.toISOString(),
      updated_at: reverted.updated_at.toISOString(),
    };
  });
}

// --- Bulk disable/enable (planning-only; is_active ignored by public handling) ---

export async function bulkDisableRedirects(actorId: string): Promise<{ affected_count: number }> {
  const session = await requireOwner();
  if (session.userId !== actorId) throw new UnauthorizedError();
  return transaction(async (client) => {
    const rows = (await client.query<{ id: string; source_path: string }>("SELECT id, source_path FROM redirects WHERE is_active=TRUE")).rows;
    await client.query("UPDATE redirects SET is_active=FALSE, updated_at=now() WHERE is_active=TRUE");
    await writeAudit(client, {
      redirect_id: null,
      action: "bulk_disabled",
      old_value: null,
      new_value: { affected_count: rows.length, affected_sources: rows.map((r) => r.source_path) },
      actor_id: actorId,
    });
    return { affected_count: rows.length };
  });
}

export async function bulkEnableRedirects(actorId: string): Promise<{ affected_count: number }> {
  const session = await requireOwner();
  if (session.userId !== actorId) throw new UnauthorizedError();
  return transaction(async (client) => {
    // Restore each rule's prior is_active from its most recent audit snapshot (not blanket TRUE).
    const rules = (await client.query<{ id: string; source_path: string }>("SELECT id, source_path FROM redirects WHERE is_active=FALSE")).rows;
    let restored = 0;
    for (const rule of rules) {
      const lastActive = (await client.query<{ new_value: string | Record<string, unknown> | null }>(
        "SELECT new_value FROM redirect_audit WHERE redirect_id=$1 AND `action` IN ('created','updated','enabled','reverted','imported') ORDER BY created_at DESC LIMIT 1",
        [rule.id],
      )).rows[0];
      // Only re-enable if the rule was previously active (per audit history).
      // Rules never activated remain inactive — safe default.
      const parsed = parseJsonColumn(lastActive?.new_value ?? null) as unknown as { is_active?: boolean } | null;
      const wasActive = parsed?.is_active === true;
      if (wasActive) {
        await client.query("UPDATE redirects SET is_active=TRUE, updated_at=now() WHERE id=$1", [rule.id]);
        await writeAudit(client, {
          redirect_id: rule.id,
          action: "enabled",
          old_value: { is_active: false },
          new_value: { is_active: true, via: "bulk_enable" },
          actor_id: actorId,
        });
        restored++;
      }
    }
    await writeAudit(client, {
      redirect_id: null,
      action: "bulk_enabled",
      old_value: null,
      new_value: { affected_count: restored, total_inactive: rules.length },
      actor_id: actorId,
    });
    return { affected_count: restored };
  });
}

// --- CSV parsing (minimal RFC-4180; no new dependencies) ---

export type CsvRow = { source_path: string; target_url: string; status_code: string; is_active: string };
export type CsvParseResult = { rows: CsvRow[]; errors: string[] };

export function parseRedirectCsv(input: string): CsvParseResult {
  // Strip UTF-8 BOM
  let text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  const errors: string[] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushField = () => { current.push(field); field = ""; };
  const pushRow = () => { rows.push(current); current = []; };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++;
        continue;
      }
      field += ch; i++;
    } else if (ch === '"') {
      if (field.length > 0) { errors.push(`Unexpected quote in unquoted field near offset ${i}.`); return { rows: [], errors }; }
      inQuotes = true; i++;
    } else if (ch === ",") {
      pushField(); i++;
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      pushField(); pushRow(); i++;
    } else if (ch === "\n") {
      pushField(); pushRow(); i++;
    } else {
      field += ch; i++;
    }
  }
  if (inQuotes) { errors.push("Unclosed quoted field at end of input."); return { rows: [], errors }; }
  // Capture the final row (input may not end with a newline), then drop trailing empty rows.
  pushField();
  pushRow();
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0].trim() === "") rows.pop();
    else break;
  }

  if (rows.length === 0) return { rows: [], errors: ["CSV is empty."] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const expected = ["source_path", "target_url", "status_code", "is_active"];
  if (header.length !== 4 || !expected.every((h, idx) => header[idx] === h)) {
    return { rows: [], errors: [`Invalid header. Expected: ${expected.join(",")}`] };
  }
  const out: CsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (cols.length === 1 && cols[0].trim() === "") continue; // skip blank lines
    if (cols.length !== 4) {
      errors.push(`Row ${r + 1}: expected 4 columns, found ${cols.length}.`);
      continue;
    }
    out.push({
      source_path: cols[0].trim(),
      target_url: cols[1].trim(),
      status_code: cols[2].trim(),
      is_active: cols[3].trim().toLowerCase(),
    });
  }
  return { rows: out, errors };
}

export type CsvImportResult = {
  imported: number;
  rejected: { row: number; source_path: string; errors: string[] }[];
};

export async function importRedirectsCsv(csvText: string, actorId: string): Promise<CsvImportResult> {
  const session = await requireOwner();
  if (session.userId !== actorId) throw new UnauthorizedError();
  const { rows, errors: parseErrors } = parseRedirectCsv(csvText);
  if (parseErrors.length > 0) {
    throw new Error(`CSV parse failed: ${parseErrors.slice(0, 3).join("; ")}`);
  }
  // Phase 1: validate all rows (schema, protected paths, self-redirect, in-file dupes)
  const seen = new Set<string>();
  const validated: { row: number; source_path: string; target_url: string; status_code: 301 | 302 | 307 | 308; is_active: boolean }[] = [];
  const rejected: CsvImportResult["rejected"] = [];
  rows.forEach((r, idx) => {
    const rowNum = idx + 2; // 1-based + header
    try {
      if (seen.has(r.source_path)) throw new Error(`duplicate source_path '${r.source_path}' in file`);
      const statusNum = Number(r.status_code);
      if (![301, 302, 307, 308].includes(statusNum)) throw new Error(`invalid status_code '${r.status_code}'`);
      const valid = validateRuleInput(r.source_path, r.target_url, statusNum);
      if (r.is_active !== "true" && r.is_active !== "false") throw new Error(`is_active must be 'true' or 'false'`);
      seen.add(r.source_path);
      validated.push({ row: rowNum, ...valid, is_active: r.is_active === "true" });
    } catch (e) {
      rejected.push({ row: rowNum, source_path: r.source_path || "(empty)", errors: [e instanceof Error ? e.message : "Invalid row."] });
    }
  });
  // Phase 2: check DB duplicates + loop/chain against existing rules (all-or-nothing)
  const edges = await getAllRulesForGraph();
  const existingSources = new Set(edges.map((e) => e.source));
  for (const v of validated) {
    if (existingSources.has(v.source_path)) {
      rejected.push({ row: v.row, source_path: v.source_path, errors: [`'${v.source_path}' already exists — edit or delete it first`] });
    }
  }
  const stillValid = validated.filter((v) => !rejected.some((r) => r.row === v.row));
  // Loop/chain check with all proposed rows applied together
  const proposedEdges: RuleEdge[] = [...edges, ...stillValid.map((v) => ({ source: v.source_path, target: v.target_url }))];
  const cycle = detectCycle(proposedEdges);
  if (cycle) {
    throw new Error(`Import rejected: redirect cycle detected (${cycle.join(" → ")}). No rows imported.`);
  }
  for (const v of stillValid) {
    const { ok, chain } = checkChainDepth(proposedEdges, v.source_path);
    if (!ok) {
      throw new Error(`Import rejected: chain exceeds 5 hops for '${v.source_path}' (${chain.join(" → ")}). No rows imported.`);
    }
  }
  // Phase 3: insert all in one transaction (all-or-nothing)
  await transaction(async (client) => {
    for (const v of stillValid) {
      const id = randomUUID();
      try {
        await client.query(
          "INSERT INTO redirects(id, source_path, target_url, status_code, is_active, created_by) VALUES($1,$2,$3,$4,$5,$6)",
          [id, v.source_path, v.target_url, v.status_code, v.is_active, actorId],
        );
      } catch (e) {
        // Race-condition duplicate: roll back entire import
        throw new Error(`Import failed at row ${v.row}: '${v.source_path}' was created concurrently. No rows imported.`);
      }
      await writeAudit(client, {
        redirect_id: id,
        action: "imported",
        old_value: null,
        new_value: { source_path: v.source_path, target_url: v.target_url, status_code: v.status_code },
        actor_id: actorId,
      });
    }
  });
  return { imported: stillValid.length, rejected };
}

export function exportRedirectsCsv(rules: RedirectRule[]): string {
  const escape = (v: string | number | boolean): string => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = ["source_path,target_url,status_code,is_active"];
  for (const r of rules) {
    lines.push([escape(r.source_path), escape(r.target_url), r.status_code, r.is_active].join(","));
  }
  return lines.join("\n") + "\n";
}
