// The guide, as rows the sales team edits rather than a document they open.
//
// Two tables, not one: a document holds sections, and a section is one product
// or one step of one call. That split is what lets the coach cite the exact
// thing it answered from, lets an edit touch one product instead of a 50 KB
// blob, and lets the page be browsed by heading instead of scrolled.
//
// `coach-guide-seed.ts` is the starting state and is read once, on an install
// whose table is empty — the same arrangement `lead-playbooks-store.ts` has
// with `lead-playbooks.ts`, and for the same reason: sales copy is rewritten far
// more often than the code around it.

import crypto from "node:crypto";
import { GUIDE_SEED } from "./coach-guide-seed.js";
import { getAdminDb } from "./user-store.js";

/**
 * Ceilings, so a paste from a Doc cannot quietly make every coach question
 * more expensive. The corpus cap in `coach-answer.ts` is the real backstop;
 * these keep one section from being the whole of it.
 */
export const MAX_HEADING = 200;
export const MAX_GROUP = 120;
export const MAX_BODY = 20_000;
export const MAX_SUMMARY = 600;

export type GuideSection = {
  id: string;
  docId: string;
  heading: string;
  group: string | null;
  bodyMd: string;
  sortOrder: number;
  updatedAt: number;
  updatedBy: string | null;
};

export type GuideDoc = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  sortOrder: number;
  updatedAt: number;
  /** Only set by the listing that counts them. */
  sectionCount?: number;
};

const trim = (value: string, max: number): string => value.trim().slice(0, max);

let seeded = false;

/**
 * Put the shipped guide in, once, if there is none.
 *
 * Guarded by both a module flag and an existence check: the flag saves the
 * query on every later call, and the check is what actually protects an install
 * where someone has since deleted every section on purpose... which would
 * re-seed. That is the deliberate trade `lead-playbooks-store.ts` makes too —
 * an empty guide is far more likely to be a fresh install than a choice.
 */
export async function ensureGuideSeed(): Promise<void> {
  if (seeded) {
    return;
  }
  seeded = true;
  const db = getAdminDb();
  const existing = await db.selectFrom("admin_guide_docs").select("id").executeTakeFirst();
  if (existing) {
    return;
  }
  const now = Date.now();
  for (const [docIndex, doc] of GUIDE_SEED.entries()) {
    const docId = crypto.randomUUID();
    await db
      .insertInto("admin_guide_docs")
      .values({
        id: docId,
        slug: doc.slug,
        title: doc.title,
        summary: doc.summary,
        sort_order: docIndex,
        created_at: now,
        updated_at: now,
        updated_by: null,
      })
      .execute();
    if (!doc.sections.length) {
      continue;
    }
    await db
      .insertInto("admin_guide_sections")
      .values(
        doc.sections.map((section, i) => ({
          id: crypto.randomUUID(),
          doc_id: docId,
          heading: trim(section.heading, MAX_HEADING),
          group_label: trim(section.group, MAX_GROUP) || null,
          body_md: trim(section.bodyMd, MAX_BODY),
          sort_order: i,
          created_at: now,
          updated_at: now,
          updated_by: null,
        })),
      )
      .execute();
  }
}

export async function listGuideDocs(): Promise<GuideDoc[]> {
  await ensureGuideSeed();
  const db = getAdminDb();
  const docs = await db
    .selectFrom("admin_guide_docs")
    .selectAll()
    .orderBy("sort_order", "asc")
    .orderBy("slug", "asc")
    .execute();
  const counts = new Map<string, number>();
  for (const row of await db.selectFrom("admin_guide_sections").select("doc_id").execute()) {
    counts.set(row.doc_id, (counts.get(row.doc_id) ?? 0) + 1);
  }
  return docs.map((d) => ({
    id: d.id,
    slug: d.slug,
    title: d.title,
    summary: d.summary,
    sortOrder: d.sort_order,
    updatedAt: d.updated_at,
    sectionCount: counts.get(d.id) ?? 0,
  }));
}

export async function listGuideSections(docId: string): Promise<GuideSection[]> {
  await ensureGuideSeed();
  const db = getAdminDb();
  const rows = await db
    .selectFrom("admin_guide_sections")
    .selectAll()
    .where("doc_id", "=", docId)
    .orderBy("sort_order", "asc")
    // The tiebreak is what makes the corpus byte-identical between calls, and
    // the corpus being byte-identical is what makes the prompt cache hit.
    .orderBy("id", "asc")
    .execute();
  return rows.map(toSection);
}

function toSection(row: {
  id: string;
  doc_id: string;
  heading: string;
  group_label: string | null;
  body_md: string;
  sort_order: number;
  updated_at: number;
  updated_by: string | null;
}): GuideSection {
  return {
    id: row.id,
    docId: row.doc_id,
    heading: row.heading,
    group: row.group_label,
    bodyMd: row.body_md,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export async function getGuideSection(id: string): Promise<GuideSection | null> {
  const db = getAdminDb();
  const row = await db
    .selectFrom("admin_guide_sections")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? toSection(row) : null;
}

export type GuideSectionInput = {
  heading: string;
  group?: string | null;
  bodyMd: string;
};

export async function createGuideSection(
  docId: string,
  input: GuideSectionInput,
  userId: string | null,
): Promise<GuideSection | null> {
  const heading = trim(input.heading, MAX_HEADING);
  if (!heading) {
    return null;
  }
  const db = getAdminDb();
  const doc = await db
    .selectFrom("admin_guide_docs")
    .select("id")
    .where("id", "=", docId)
    .executeTakeFirst();
  if (!doc) {
    return null;
  }
  const last = await db
    .selectFrom("admin_guide_sections")
    .select("sort_order")
    .where("doc_id", "=", docId)
    .orderBy("sort_order", "desc")
    .executeTakeFirst();
  const now = Date.now();
  const id = crypto.randomUUID();
  await db
    .insertInto("admin_guide_sections")
    .values({
      id,
      doc_id: docId,
      heading,
      group_label: input.group ? trim(input.group, MAX_GROUP) || null : null,
      body_md: trim(input.bodyMd, MAX_BODY),
      sort_order: (last?.sort_order ?? -1) + 1,
      created_at: now,
      updated_at: now,
      updated_by: userId,
    })
    .execute();
  return getGuideSection(id);
}

export async function updateGuideSection(
  id: string,
  input: Partial<GuideSectionInput>,
  userId: string | null,
): Promise<GuideSection | null> {
  const db = getAdminDb();
  const existing = await getGuideSection(id);
  if (!existing) {
    return null;
  }
  const heading = input.heading === undefined ? existing.heading : trim(input.heading, MAX_HEADING);
  if (!heading) {
    return null;
  }
  await db
    .updateTable("admin_guide_sections")
    .set({
      heading,
      group_label:
        input.group === undefined
          ? existing.group
          : input.group
            ? trim(input.group, MAX_GROUP) || null
            : null,
      body_md: input.bodyMd === undefined ? existing.bodyMd : trim(input.bodyMd, MAX_BODY),
      updated_at: Date.now(),
      updated_by: userId,
    })
    .where("id", "=", id)
    .execute();
  return getGuideSection(id);
}

export async function deleteGuideSection(id: string): Promise<boolean> {
  const db = getAdminDb();
  const result = await db
    .deleteFrom("admin_guide_sections")
    .where("id", "=", id)
    .executeTakeFirst();
  return Number(result?.numDeletedRows ?? 0) > 0;
}

/** Reorder by listing ids in the order wanted. Ids not in the doc are ignored. */
export async function reorderGuideSections(docId: string, ids: string[]): Promise<void> {
  const db = getAdminDb();
  const current = await listGuideSections(docId);
  const known = new Set(current.map((s) => s.id));
  const ordered = ids.filter((id) => known.has(id));
  // Anything the caller left out keeps its relative place at the end, so a
  // stale list from a page opened before a section was added cannot delete an
  // ordering.
  for (const section of current) {
    if (!ordered.includes(section.id)) {
      ordered.push(section.id);
    }
  }
  const now = Date.now();
  for (const [index, id] of ordered.entries()) {
    await db
      .updateTable("admin_guide_sections")
      .set({ sort_order: index, updated_at: now })
      .where("id", "=", id)
      .execute();
  }
}

export async function updateGuideDoc(
  id: string,
  input: { title?: string; summary?: string | null },
  userId: string | null,
): Promise<GuideDoc | null> {
  const db = getAdminDb();
  const existing = await db
    .selectFrom("admin_guide_docs")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (!existing) {
    return null;
  }
  const title = input.title === undefined ? existing.title : trim(input.title, MAX_HEADING);
  if (!title) {
    return null;
  }
  await db
    .updateTable("admin_guide_docs")
    .set({
      title,
      summary:
        input.summary === undefined
          ? existing.summary
          : input.summary
            ? trim(input.summary, MAX_SUMMARY) || null
            : null,
      updated_at: Date.now(),
      updated_by: userId,
    })
    .where("id", "=", id)
    .execute();
  const docs = await listGuideDocs();
  return docs.find((d) => d.id === id) ?? null;
}

export type GuideCorpus = {
  /** The whole guide as one block, in a stable order. */
  text: string;
  /** Section ids in the order they appear, so a citation can be checked. */
  sectionIds: string[];
  /** Heading by id, for turning a citation into something readable. */
  headings: Map<string, string>;
  /** Rough token count — characters over 3.7, good enough for a ceiling. */
  approxTokens: number;
};

/**
 * The whole guide, assembled for the model.
 *
 * Order is documents by `sort_order` then slug, sections by `sort_order` then
 * id — fixed, because this block is sent with `cache_control` and a cache entry
 * is keyed on an exact prefix. Two calls that assemble the same guide in a
 * different order would pay full price for both.
 */
export async function guideCorpus(): Promise<GuideCorpus> {
  const docs = await listGuideDocs();
  const parts: string[] = [];
  const sectionIds: string[] = [];
  const headings = new Map<string, string>();
  for (const doc of docs) {
    const sections = await listGuideSections(doc.id);
    if (!sections.length) {
      continue;
    }
    parts.push(`# ${doc.title}`);
    if (doc.summary) {
      parts.push(doc.summary);
    }
    let group: string | null = null;
    for (const section of sections) {
      if (section.group && section.group !== group) {
        group = section.group;
        parts.push(`## ${group}`);
      }
      parts.push(
        `### ${section.heading}`,
        `<section id="${section.id}">`,
        section.bodyMd,
        "</section>",
      );
      sectionIds.push(section.id);
      headings.set(section.id, section.heading);
    }
  }
  const text = parts.join("\n\n");
  return { text, sectionIds, headings, approxTokens: Math.round(text.length / 3.7) };
}
