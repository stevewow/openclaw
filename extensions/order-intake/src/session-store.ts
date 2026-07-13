// Per-visitor conversation state for the web chat. Keyed by visitor + listing so
// a conversation resumes if the page is reloaded or interrupted (spec §2). M0
// keeps this in memory; a durable store can implement the same interface later.

import type { OrderDraft } from "./order-draft.js";

export type ChatRole = "visitor" | "assistant";
export type ChatMessage = { role: ChatRole; text: string; at: number };

export type IntakeSession = {
  id: string;
  visitorId: string;
  listingId?: string;
  createdAt: number;
  updatedAt: number;
  history: ChatMessage[];
  draft: OrderDraft;
  handedOff: boolean;
};

export function emptyDraft(): OrderDraft {
  return { service: {}, property: {}, addOns: [], agent: {}, customAnswers: {} };
}

export function sessionKey(visitorId: string, listingId?: string): string {
  return listingId ? `${visitorId}::${listingId}` : visitorId;
}

export interface SessionStore {
  get(visitorId: string, listingId?: string): IntakeSession | undefined;
  getOrCreate(visitorId: string, listingId: string | undefined, now: number): IntakeSession;
  save(session: IntakeSession): void;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, IntakeSession>();

  get(visitorId: string, listingId?: string): IntakeSession | undefined {
    return this.sessions.get(sessionKey(visitorId, listingId));
  }

  getOrCreate(visitorId: string, listingId: string | undefined, now: number): IntakeSession {
    const key = sessionKey(visitorId, listingId);
    const existing = this.sessions.get(key);
    if (existing) return existing;
    const session: IntakeSession = {
      id: key,
      visitorId,
      listingId,
      createdAt: now,
      updatedAt: now,
      history: [],
      draft: emptyDraft(),
      handedOff: false,
    };
    this.sessions.set(key, session);
    return session;
  }

  save(session: IntakeSession): void {
    session.updatedAt = Math.max(session.updatedAt, session.createdAt);
    this.sessions.set(sessionKey(session.visitorId, session.listingId), session);
  }
}
