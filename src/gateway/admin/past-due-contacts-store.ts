// Contacts a collector actually made, logged from the Past Due drawer.
//
// This is deliberately separate from Pipedrive activity. Pipedrive says when
// anyone in the business last touched a client for any reason; this says when
// someone chased the money, on what channel, and what came of it. When both
// exist the logged contact is the one collections cares about, so the report
// prefers it and shows the Pipedrive date as the fallback.
//
// Keyed by the same `account_key` the breakdown groups on, so the log survives
// the wholesale replacement of the invoice snapshot on every Spiro refresh.

import { randomUUID } from "node:crypto";
import { getAdminDb } from "./user-store.js";

export type ContactChannel = "call" | "voicemail" | "email" | "text" | "letter" | "in_person";

export const CONTACT_CHANNELS: Array<{ key: ContactChannel; label: string }> = [
  { key: "call", label: "Call" },
  { key: "voicemail", label: "Voicemail" },
  { key: "email", label: "Email" },
  { key: "text", label: "Text" },
  { key: "letter", label: "Letter" },
  { key: "in_person", label: "In person" },
];

const CHANNEL_KEYS = new Set<string>(CONTACT_CHANNELS.map((c) => c.key));

export function isContactChannel(value: unknown): value is ContactChannel {
  return typeof value === "string" && CHANNEL_KEYS.has(value);
}

export function contactChannelLabel(key: string): string {
  return CONTACT_CHANNELS.find((c) => c.key === key)?.label ?? key;
}

export type PastDueContact = {
  id: string;
  accountKey: string;
  contactedAt: number;
  channel: ContactChannel;
  note: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: number;
};

export type LastContact = {
  at: number;
  channel: ContactChannel;
  byName: string | null;
};

type Row = {
  id: string;
  account_key: string;
  contacted_at: number;
  channel: string;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: number;
};

const MAX_NOTE_LENGTH = 2000;

function rowToContact(r: Row): PastDueContact {
  return {
    id: r.id,
    accountKey: r.account_key,
    contactedAt: r.contacted_at,
    channel: isContactChannel(r.channel) ? r.channel : "call",
    note: r.note,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  };
}

export async function logContact(params: {
  accountKey: string;
  contactedAt?: number;
  channel: ContactChannel;
  note?: string | null;
  userId: string | null;
  userName: string | null;
}): Promise<PastDueContact> {
  const now = Date.now();
  const note = params.note?.trim() ? params.note.trim().slice(0, MAX_NOTE_LENGTH) : null;
  const row: Row = {
    id: randomUUID(),
    account_key: params.accountKey,
    // A collector logging yesterday's call should not have it dated today, but
    // a future contact is a reminder, not a contact.
    contacted_at: Math.min(params.contactedAt ?? now, now),
    channel: params.channel,
    note,
    created_by: params.userId,
    created_by_name: params.userName,
    created_at: now,
  };
  await getAdminDb().insertInto("admin_past_due_contacts").values(row).execute();
  return rowToContact(row);
}

/** Every logged contact for one account, most recent first. */
export async function listContacts(accountKey: string): Promise<PastDueContact[]> {
  const rows = (await getAdminDb()
    .selectFrom("admin_past_due_contacts")
    .selectAll()
    .where("account_key", "=", accountKey)
    .orderBy("contacted_at", "desc")
    .execute()) as Row[];
  return rows.map(rowToContact);
}

export async function getContact(id: string): Promise<PastDueContact | null> {
  const row = (await getAdminDb()
    .selectFrom("admin_past_due_contacts")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst()) as Row | undefined;
  return row ? rowToContact(row) : null;
}

export async function deleteContact(id: string): Promise<void> {
  await getAdminDb().deleteFrom("admin_past_due_contacts").where("id", "=", id).execute();
}

/**
 * The latest logged contact per account, for the report table. One query for
 * the whole board rather than one per row.
 */
export async function lastContactByAccount(): Promise<Map<string, LastContact>> {
  const rows = (await getAdminDb()
    .selectFrom("admin_past_due_contacts")
    .select(["account_key", "contacted_at", "channel", "created_by_name"])
    .orderBy("contacted_at", "desc")
    .execute()) as Array<Pick<Row, "account_key" | "contacted_at" | "channel" | "created_by_name">>;
  const out = new Map<string, LastContact>();
  for (const r of rows) {
    // Rows arrive newest-first, so the first hit per account is the latest.
    if (out.has(r.account_key)) {
      continue;
    }
    out.set(r.account_key, {
      at: r.contacted_at,
      channel: isContactChannel(r.channel) ? r.channel : "call",
      byName: r.created_by_name,
    });
  }
  return out;
}
