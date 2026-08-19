// Team feedback, replacing the ClickUp form the team had been submitting to.
//
// The field list is not invented: it mirrors the live ClickUp form's own
// definitions, and the option lists below are the exact labels that form
// offered, so the 222 imported submissions and anything typed from now on
// share one vocabulary. Anything ClickUp defined but nobody ever filled in
// (its duplicate checkbox "Feedback Source", the "Appointment Address" text
// field, the "Your Name" user picker) is deliberately not carried over.

import crypto from "node:crypto";
import { getAdminDb } from "./user-store.js";

// ── The form's vocabulary ─────────────────────────────────────────────────

/** Who the feedback is about, as the ClickUp form worded it. */
export const FEEDBACK_SOURCES = ["Employee Feedback", "Client Feedback"] as const;

/**
 * The category list, verbatim from ClickUp including its parenthetical hints.
 * Kept word-for-word so imported rows need no mapping table and the team reads
 * the same options they have been picking for the last year and a half.
 */
export const FEEDBACK_CATEGORIES = [
  "Spiro Issues",
  "Appointment Availability Feedback (Limited appointment times available, availability outside of standards, etc.)",
  "Photographer Feedback (Late arrival, no-show, customer service issue, etc.)",
  "Media Feedback (Quality issues, missing media, etc.)",
  "Billing (Billing errors, missing invoices, etc.)",
  "AutoHDR",
] as const;

/**
 * The category that unlocks the appointment-availability questions. In the
 * ClickUp data every submission carrying a listing address, requested time or
 * service list sat under this category and no other, so the branch is real
 * rather than a habit of whoever filled it in.
 */
export const APPOINTMENT_CATEGORY = FEEDBACK_CATEGORIES[1];

/** Services offered, shown only on the appointment-availability branch. */
export const FEEDBACK_SERVICES = [
  "HDR Photography",
  "Walkthrough Video",
  "Aerials",
  "Zillow 3D",
  "CubiCasa",
  "Vertical Video",
  "Agent-On-Camera Video (AH HA)",
  "Matterport",
] as const;

/** The people the ClickUp dropdown offered, in its own order. */
export const FEEDBACK_SUBMITTERS = [
  "Brittany Duerk",
  "Jessica Crawford",
  "Alex Davis",
  "Evan Barr",
  "Besa Zeneli",
  "Tina Zeneli",
  "Jess Paxson",
  "Pam Branam",
  "Joy Kiser",
  "Carter Knox",
  "Craig Magrum",
  "Tessa Schmenk",
  "Steve Musser",
  "Editing Team",
  "Jessie Mallari",
  "Patrick Rosa",
  "Chris Voge",
] as const;

/**
 * The workflow, carried over from the ClickUp list's own statuses so the
 * imported backlog lands where it already was rather than all in one pile.
 */
export const FEEDBACK_STATUSES = [
  { key: "to_review", label: "To review", clickup: "to review" },
  { key: "photographers", label: "Photographers", clickup: "photographers" },
  {
    key: "appointment_availability",
    label: "Appointment availability",
    clickup: "appointment availability",
  },
  { key: "billing", label: "Billing", clickup: "billing" },
  { key: "complete", label: "Complete", clickup: "complete" },
] as const;

export type FeedbackStatusKey = (typeof FEEDBACK_STATUSES)[number]["key"];

const STATUS_KEYS = new Set<string>(FEEDBACK_STATUSES.map((s) => s.key));

export function isFeedbackStatus(v: unknown): v is FeedbackStatusKey {
  return typeof v === "string" && STATUS_KEYS.has(v);
}

/** ClickUp's status string → ours. Unknown values park in "to review". */
export function statusFromClickUp(raw: string | null | undefined): FeedbackStatusKey {
  const want = (raw ?? "").trim().toLowerCase();
  const hit = FEEDBACK_STATUSES.find((s) => s.clickup === want);
  return hit ? hit.key : "to_review";
}

// ── Types ─────────────────────────────────────────────────────────────────

export type FeedbackAttachment = {
  id: string;
  filename: string;
  mimeType: string | null;
  byteSize: number | null;
  /** Null when the bytes were never fetched; `sourceUrl` is then the only copy. */
  storedPath: string | null;
  sourceUrl: string | null;
};

export type FeedbackEntry = {
  id: string;
  reference: string;
  source: string[];
  categories: string[];
  body: string;
  /** The picked name from the roster, when one was chosen. */
  submittedBy: string | null;
  /** A name typed on the public form, when the submitter is not on the roster. */
  submittedByName: string | null;
  appointmentLink: string | null;
  listingAddress: string | null;
  selectedServices: string[];
  requestedAt: number | null;
  firstAvailableAt: number | null;
  status: FeedbackStatusKey;
  clickupId: string | null;
  createdAt: number;
  updatedAt: number;
  attachments: FeedbackAttachment[];
};

export type FeedbackSubmission = {
  source: string[];
  categories: string[];
  body: string;
  submittedBy?: string | null;
  submittedByName?: string | null;
  appointmentLink?: string | null;
  listingAddress?: string | null;
  selectedServices?: string[];
  requestedAt?: number | null;
  firstAvailableAt?: number | null;
  /** Import-only: preserves the original submission time and identity. */
  createdAt?: number;
  status?: FeedbackStatusKey;
  clickupId?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function parseJsonArray(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Keep only values the form actually offers.
 *
 * The public page is unauthenticated, so nothing it sends about its own
 * options is believed — the same rule the ticket intake form follows for
 * prices. An unknown label is dropped rather than stored, which keeps the
 * reporting vocabulary closed.
 */
function keepKnown(values: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const set = new Set(allowed);
  const out: string[] = [];
  for (const v of values) {
    if (typeof v === "string" && set.has(v) && !out.includes(v)) {
      out.push(v);
    }
  }
  return out;
}

function trimOrNull(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") {
    return null;
  }
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/**
 * Next reference in the FB-0001 series.
 *
 * Read from a stored counter rather than MAX(reference): deleting the newest
 * submission must not hand its number to the next one, or a note citing
 * FB-0007 would later point at different feedback. Seeded past whatever is
 * already filed so an import that pre-dates the counter cannot collide.
 */
async function nextReference(): Promise<string> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_feedback_seq")
    .select("next_number")
    .where("id", "=", 1)
    .executeTakeFirst();

  let next = row?.next_number ?? 0;
  if (!row) {
    const rows = await db.selectFrom("admin_feedback").select("reference").execute();
    let max = 0;
    for (const r of rows) {
      const m = /^FB-(\d+)$/.exec(r.reference);
      if (m) {
        max = Math.max(max, Number(m[1]));
      }
    }
    next = max + 1;
  }

  await db
    .insertInto("admin_feedback_seq")
    .values({ id: 1, next_number: next + 1 })
    .onConflict((oc) => oc.column("id").doUpdateSet({ next_number: next + 1 }))
    .execute();
  return `FB-${String(next).padStart(4, "0")}`;
}

function rowToEntry(
  row: {
    id: string;
    reference: string;
    source: string;
    categories: string;
    body: string;
    submitted_by: string | null;
    submitted_by_name: string | null;
    appointment_link: string | null;
    listing_address: string | null;
    selected_services: string | null;
    requested_at: number | null;
    first_available_at: number | null;
    status: string;
    clickup_id: string | null;
    created_at: number;
    updated_at: number;
  },
  attachments: FeedbackAttachment[],
): FeedbackEntry {
  return {
    id: row.id,
    reference: row.reference,
    source: parseJsonArray(row.source),
    categories: parseJsonArray(row.categories),
    body: row.body,
    submittedBy: row.submitted_by,
    submittedByName: row.submitted_by_name,
    appointmentLink: row.appointment_link,
    listingAddress: row.listing_address,
    selectedServices: parseJsonArray(row.selected_services),
    requestedAt: row.requested_at,
    firstAvailableAt: row.first_available_at,
    status: isFeedbackStatus(row.status) ? row.status : "to_review",
    clickupId: row.clickup_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachments,
  };
}

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * File a submission.
 *
 * `clickupId` makes the import idempotent: re-running it updates the row that
 * came from the same ClickUp task instead of filing a second copy.
 */
export async function createFeedback(input: FeedbackSubmission): Promise<FeedbackEntry> {
  const db = getAdminDb();
  const now = Date.now();
  const createdAt = typeof input.createdAt === "number" ? input.createdAt : now;

  const body = typeof input.body === "string" ? input.body.trim().slice(0, 20000) : "";
  const values = {
    source: JSON.stringify(keepKnown(input.source, FEEDBACK_SOURCES)),
    categories: JSON.stringify(keepKnown(input.categories, FEEDBACK_CATEGORIES)),
    body,
    submitted_by:
      typeof input.submittedBy === "string" &&
      FEEDBACK_SUBMITTERS.includes(input.submittedBy as (typeof FEEDBACK_SUBMITTERS)[number])
        ? input.submittedBy
        : null,
    submitted_by_name: trimOrNull(input.submittedByName, 120),
    appointment_link: trimOrNull(input.appointmentLink),
    listing_address: trimOrNull(input.listingAddress, 400),
    selected_services: JSON.stringify(keepKnown(input.selectedServices, FEEDBACK_SERVICES)),
    requested_at: typeof input.requestedAt === "number" ? input.requestedAt : null,
    first_available_at: typeof input.firstAvailableAt === "number" ? input.firstAvailableAt : null,
    status: input.status && isFeedbackStatus(input.status) ? input.status : "to_review",
    updated_at: now,
  };

  if (input.clickupId) {
    const existing = await db
      .selectFrom("admin_feedback")
      .selectAll()
      .where("clickup_id", "=", input.clickupId)
      .executeTakeFirst();
    if (existing) {
      await db
        .updateTable("admin_feedback")
        .set({ ...values, created_at: createdAt })
        .where("id", "=", existing.id)
        .execute();
      const got = await getFeedback(existing.id);
      if (got) {
        return got;
      }
    }
  }

  const id = crypto.randomUUID();
  await db
    .insertInto("admin_feedback")
    .values({
      id,
      reference: await nextReference(),
      ...values,
      clickup_id: input.clickupId ?? null,
      created_at: createdAt,
    })
    .execute();
  const got = await getFeedback(id);
  if (!got) {
    throw new Error("feedback row vanished immediately after insert");
  }
  return got;
}

export async function addFeedbackAttachment(
  feedbackId: string,
  file: {
    filename: string;
    mimeType?: string | null;
    byteSize?: number | null;
    storedPath?: string | null;
    sourceUrl?: string | null;
  },
): Promise<void> {
  const db = getAdminDb();
  await db
    .insertInto("admin_feedback_attachments")
    .values({
      id: crypto.randomUUID(),
      feedback_id: feedbackId,
      filename: file.filename.slice(0, 300),
      mime_type: file.mimeType ?? null,
      byte_size: typeof file.byteSize === "number" ? file.byteSize : null,
      stored_path: file.storedPath ?? null,
      source_url: file.sourceUrl ?? null,
      created_at: Date.now(),
    })
    .execute();
}

/** Replace an imported row's attachments, so a re-import does not duplicate them. */
export async function clearFeedbackAttachments(feedbackId: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_feedback_attachments").where("feedback_id", "=", feedbackId).execute();
}

export async function setFeedbackStatus(id: string, status: FeedbackStatusKey): Promise<void> {
  const db = getAdminDb();
  await db
    .updateTable("admin_feedback")
    .set({ status, updated_at: Date.now() })
    .where("id", "=", id)
    .execute();
}

export async function deleteFeedback(id: string): Promise<void> {
  const db = getAdminDb();
  await db.deleteFrom("admin_feedback").where("id", "=", id).execute();
}

// ── Reads ─────────────────────────────────────────────────────────────────

async function attachmentsFor(ids: string[]): Promise<Map<string, FeedbackAttachment[]>> {
  const out = new Map<string, FeedbackAttachment[]>();
  if (ids.length === 0) {
    return out;
  }
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_feedback_attachments")
    .selectAll()
    .where("feedback_id", "in", ids)
    .execute();
  for (const r of rows) {
    const list = out.get(r.feedback_id) ?? [];
    list.push({
      id: r.id,
      filename: r.filename,
      mimeType: r.mime_type,
      byteSize: r.byte_size,
      storedPath: r.stored_path,
      sourceUrl: r.source_url,
    });
    out.set(r.feedback_id, list);
  }
  return out;
}

export async function getFeedback(id: string): Promise<FeedbackEntry | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_feedback")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row) {
    return null;
  }
  const att = await attachmentsFor([row.id]);
  return rowToEntry(row, att.get(row.id) ?? []);
}

export type FeedbackListFilter = {
  status?: FeedbackStatusKey | "all";
  category?: string;
  source?: string;
  /** Case-insensitive substring over the body and the submitter's name. */
  search?: string;
};

export async function listFeedback(filter: FeedbackListFilter = {}): Promise<FeedbackEntry[]> {
  const db = getAdminDb();
  let q = db.selectFrom("admin_feedback").selectAll();
  if (filter.status && filter.status !== "all") {
    q = q.where("status", "=", filter.status);
  }
  const rows = await q.orderBy("created_at", "desc").execute();
  const att = await attachmentsFor(rows.map((r) => r.id));
  let entries = rows.map((r) => rowToEntry(r, att.get(r.id) ?? []));

  // Category and source live in JSON arrays, so they are filtered in memory
  // rather than with a LIKE that would match a label inside another label.
  if (filter.category) {
    entries = entries.filter((e) => e.categories.includes(filter.category ?? ""));
  }
  if (filter.source) {
    entries = entries.filter((e) => e.source.includes(filter.source ?? ""));
  }
  if (filter.search) {
    const needle = filter.search.trim().toLowerCase();
    if (needle) {
      entries = entries.filter(
        (e) =>
          e.body.toLowerCase().includes(needle) ||
          (e.submittedBy ?? "").toLowerCase().includes(needle) ||
          (e.submittedByName ?? "").toLowerCase().includes(needle) ||
          e.reference.toLowerCase().includes(needle),
      );
    }
  }
  return entries;
}

export type FeedbackSummary = {
  total: number;
  byStatus: Array<{ status: FeedbackStatusKey; label: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
};

export async function getFeedbackSummary(): Promise<FeedbackSummary> {
  const entries = await listFeedback();
  const status = new Map<string, number>();
  const cat = new Map<string, number>();
  const src = new Map<string, number>();
  for (const e of entries) {
    status.set(e.status, (status.get(e.status) ?? 0) + 1);
    for (const c of e.categories) {
      cat.set(c, (cat.get(c) ?? 0) + 1);
    }
    for (const s of e.source) {
      src.set(s, (src.get(s) ?? 0) + 1);
    }
  }
  return {
    total: entries.length,
    byStatus: FEEDBACK_STATUSES.map((s) => ({
      status: s.key,
      label: s.label,
      count: status.get(s.key) ?? 0,
    })),
    byCategory: FEEDBACK_CATEGORIES.map((c) => ({ category: c, count: cat.get(c) ?? 0 })).filter(
      (r) => r.count > 0,
    ),
    bySource: FEEDBACK_SOURCES.map((s) => ({ source: s, count: src.get(s) ?? 0 })),
  };
}
