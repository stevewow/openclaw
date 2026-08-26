// Admin routes for the lead queue, under /api/admin/leads and /api/admin/lead-territories.
//
// Its own module rather than more of admin-http.ts. Auth, the session lookup and
// the `leads` feature gate all run there before this is reached; what is decided
// here is only what a viewer may do once inside the section, which is the one
// thing the gate cannot express: anybody who can see the queue can work it, but
// the routing table — the thing that decides who gets emailed — is an admin's.

import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "../hooks.js";
import { sendJson } from "../http-common.js";
import { renderLeadEmailText } from "./lead-email-render.js";
import { dispatchLead } from "./lead-notify.js";
import {
  createPlaybook,
  deletePlaybook,
  getLeadSettings,
  getPlaybook,
  listPlaybooks,
  reorderPlaybooks,
  setLeadSettings,
  updatePlaybook,
} from "./lead-playbooks-store.js";
import {
  addLeadEvent,
  assignLead,
  createLead,
  deleteLead,
  getLead,
  isLeadStatus,
  type Lead,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  type ListLeadsFilter,
  listLeadEvents,
  listLeads,
  setLeadStatus,
  summarizeLeads,
} from "./lead-store.js";
import {
  createTerritory,
  deleteTerritory,
  ensureTerritorySeed,
  getTerritory,
  listTerritories,
  updateTerritory,
} from "./lead-territories.js";

const MAX_BODY_BYTES = 64 * 1024;

export type LeadRequestContext = {
  /** Named on the trail, so "Steve moved this to Contacted" reads as a person. */
  actorName: string;
  /** Only an admin may edit the routing table. */
  isAdmin: boolean;
};

function sendBadRequest(res: ServerResponse, message: string): void {
  sendJson(res, 400, { error: message });
}

function sendNotFound(res: ServerResponse): void {
  sendJson(res, 404, { error: "not_found" });
}

function sendForbidden(res: ServerResponse): void {
  sendJson(res, 403, { error: "forbidden" });
}

/** Read the edit form's body into what the store takes. */
function playbookInput(
  data: Record<string, unknown>,
  label: string | null,
): { label: string } & Record<string, unknown> {
  return {
    label: label ?? "",
    signal: str(data.signal) ?? undefined,
    opener: str(data.opener) ?? undefined,
    softClose: str(data.softClose) ?? undefined,
    matchTerms: aliasList(data.matchTerms),
    steps: Array.isArray(data.steps)
      ? data.steps.flatMap((entry) => {
          if (!entry || typeof entry !== "object") {
            return [];
          }
          const row = entry as Record<string, unknown>;
          return [
            {
              when: str(row.when) ?? "",
              channel: typeof row.channel === "string" ? row.channel : "call",
              action: str(row.action) ?? "",
            },
          ];
        })
      : undefined,
    active: data.active === undefined ? undefined : Boolean(data.active),
  };
}

/**
 * The lead a preview is rendered against. Invented rather than a real one: the
 * point is to read the copy, and a preview that pulled somebody's actual
 * enquiry would put a client's details on an editing screen.
 */
function previewLead(): Lead {
  const now = Date.now();
  return {
    id: "preview",
    number: "LEAD-0000",
    source: "framer",
    formName: "Preview",
    submissionId: null,
    name: "Dana Reyes",
    email: "dana@example.com",
    phone: "(614) 555-0111",
    company: "Example Realty",
    message: "Got a listing going up in a couple of weeks.",
    marketRaw: "Columbus",
    territoryKey: "columbus",
    ownerName: "Chris Voge",
    ownerEmail: "chris@example.com",
    status: "new",
    pageUrl: null,
    fields: [],
    playbookKey: "preview",
    notifiedAt: null,
    notifyError: null,
    createdAt: now,
    updatedAt: now,
  };
}

function previewSteps(raw: unknown): Array<{
  step: number;
  when: string;
  channel: "call" | "email" | "call_or_email";
  action: string;
}> {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((entry, i) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const row = entry as Record<string, unknown>;
    const channel = row.channel;
    return [
      {
        step: i + 1,
        when: str(row.when) ?? "",
        channel:
          channel === "email" || channel === "call_or_email" || channel === "call"
            ? channel
            : "call",
        action: str(row.action) ?? "",
      },
    ];
  });
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function aliasList(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
  return [];
}

/** Everything the Leads page needs to draw itself, in one round trip. */
async function respondWithQueue(res: ServerResponse, url: URL): Promise<void> {
  await ensureTerritorySeed();
  const statusParam = url.searchParams.get("status");
  const filter: ListLeadsFilter = {
    status:
      statusParam === "open" || statusParam === "all" || isLeadStatus(statusParam)
        ? statusParam
        : "all",
    territoryKey: url.searchParams.get("territory") ?? undefined,
    days: Number.parseInt(url.searchParams.get("days") ?? "", 10) || undefined,
    q: url.searchParams.get("q") ?? undefined,
  };
  const leads = await listLeads(filter);
  sendJson(res, 200, {
    leads,
    // Summarized over the filtered set on purpose: a count beside a table that
    // disagrees with the rows in it is worse than no count.
    summary: summarizeLeads(leads),
    statuses: LEAD_STATUSES.map((key) => ({ key, label: LEAD_STATUS_LABELS[key] })),
    territories: await listTerritories(),
  });
}

export async function handleLeadAdminRequest(
  subPath: string,
  req: IncomingMessage,
  res: ServerResponse,
  ctx: LeadRequestContext,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";

  // ── The routing table ───────────────────────────────────────────────────
  if (subPath === "/lead-territories" || subPath.startsWith("/lead-territories/")) {
    if (!ctx.isAdmin) {
      sendForbidden(res);
      return true;
    }
    if (subPath === "/lead-territories" && method === "GET") {
      await ensureTerritorySeed();
      sendJson(res, 200, { territories: await listTerritories() });
      return true;
    }
    if (subPath === "/lead-territories" && method === "POST") {
      const body = await readJsonBody(req, MAX_BODY_BYTES);
      if (!body.ok) {
        sendBadRequest(res, body.error);
        return true;
      }
      const data = body.value as Record<string, unknown>;
      const label = str(data.label);
      if (!label) {
        sendBadRequest(res, "label required");
        return true;
      }
      try {
        const territory = await createTerritory({
          label,
          aliases: aliasList(data.aliases),
          ownerName: str(data.ownerName),
          ownerEmail: str(data.ownerEmail),
          active: data.active === undefined ? true : Boolean(data.active),
        });
        sendJson(res, 201, { territory });
      } catch (err) {
        if (err instanceof Error && err.message === "territory_exists") {
          sendJson(res, 409, { error: "territory_exists" });
          return true;
        }
        throw err;
      }
      return true;
    }
    const key = decodeURIComponent(subPath.slice("/lead-territories/".length));
    if (!key) {
      sendNotFound(res);
      return true;
    }
    if (method === "PUT") {
      const body = await readJsonBody(req, MAX_BODY_BYTES);
      if (!body.ok) {
        sendBadRequest(res, body.error);
        return true;
      }
      const data = body.value as Record<string, unknown>;
      const territory = await updateTerritory(key, {
        label: data.label === undefined ? undefined : (str(data.label) ?? undefined),
        aliases: aliasList(data.aliases),
        ownerName: data.ownerName === undefined ? undefined : str(data.ownerName),
        ownerEmail: data.ownerEmail === undefined ? undefined : str(data.ownerEmail),
        active: data.active === undefined ? undefined : Boolean(data.active),
      });
      if (!territory) {
        sendNotFound(res);
        return true;
      }
      sendJson(res, 200, { territory });
      return true;
    }
    if (method === "DELETE") {
      await deleteTerritory(key);
      sendJson(res, 200, { ok: true });
      return true;
    }
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }

  // ── The outreach notes ──────────────────────────────────────────────────
  // Sales copy, edited live. Admin-only for the same reason the routing table
  // is: this is what goes out over somebody else's name.
  if (subPath === "/lead-playbooks" || subPath.startsWith("/lead-playbooks/")) {
    if (!ctx.isAdmin) {
      sendForbidden(res);
      return true;
    }
    if (subPath === "/lead-playbooks" && method === "GET") {
      sendJson(res, 200, { playbooks: await listPlaybooks(), settings: await getLeadSettings() });
      return true;
    }
    if (subPath === "/lead-playbooks" && method === "POST") {
      const body = await readJsonBody(req, MAX_BODY_BYTES);
      if (!body.ok) {
        sendBadRequest(res, body.error);
        return true;
      }
      const data = body.value as Record<string, unknown>;
      const label = str(data.label);
      if (!label) {
        sendBadRequest(res, "label required");
        return true;
      }
      try {
        sendJson(res, 201, { playbook: await createPlaybook(playbookInput(data, label)) });
      } catch (err) {
        if (err instanceof Error && err.message === "playbook_exists") {
          sendJson(res, 409, { error: "playbook_exists" });
          return true;
        }
        throw err;
      }
      return true;
    }
    // What the email will actually say, rendered from what is on the form right
    // now. Editing copy blind and sending yourself a test lead to read it is the
    // loop this exists to close.
    if (subPath === "/lead-playbooks/preview" && method === "POST") {
      const body = await readJsonBody(req, MAX_BODY_BYTES);
      if (!body.ok) {
        sendBadRequest(res, body.error);
        return true;
      }
      const data = body.value as Record<string, unknown>;
      const settings = await getLeadSettings();
      sendJson(res, 200, {
        text: renderLeadEmailText({
          lead: previewLead(),
          logoUrl: "",
          playbook: {
            key: "preview",
            label: str(data.label) ?? "Preview",
            signal: str(data.signal) ?? "",
            opener: str(data.opener) ?? "",
            softClose: str(data.softClose) ?? "",
            matchTerms: [],
            steps: previewSteps(data.steps),
            active: true,
            sortOrder: 0,
          },
          standardFollowUp: str(data.standardFollowUp) ?? settings.standardFollowUp,
          attemptsBeforeStandard: settings.attemptsBeforeStandard,
        }),
      });
      return true;
    }
    if (subPath === "/lead-playbooks/settings" && method === "PUT") {
      const body = await readJsonBody(req, MAX_BODY_BYTES);
      if (!body.ok) {
        sendBadRequest(res, body.error);
        return true;
      }
      const data = body.value as Record<string, unknown>;
      // The form sends a number, an older client might send the string in the
      // box; anything else is not a figure and leaves the setting alone.
      const rawAttempts = data.attemptsBeforeStandard;
      const attempts =
        typeof rawAttempts === "number"
          ? rawAttempts
          : typeof rawAttempts === "string"
            ? Number.parseInt(rawAttempts, 10)
            : Number.NaN;
      sendJson(res, 200, {
        settings: await setLeadSettings({
          standardFollowUp: str(data.standardFollowUp) ?? undefined,
          attemptsBeforeStandard: Number.isFinite(attempts) ? attempts : undefined,
        }),
      });
      return true;
    }
    if (subPath === "/lead-playbooks/reorder" && method === "PUT") {
      const body = await readJsonBody(req, MAX_BODY_BYTES);
      if (!body.ok) {
        sendBadRequest(res, body.error);
        return true;
      }
      const keys = (body.value as Record<string, unknown>).keys;
      if (!Array.isArray(keys)) {
        sendBadRequest(res, "keys required");
        return true;
      }
      sendJson(res, 200, {
        playbooks: await reorderPlaybooks(keys.filter((k): k is string => typeof k === "string")),
      });
      return true;
    }
    const key = decodeURIComponent(subPath.slice("/lead-playbooks/".length));
    if (!key) {
      sendNotFound(res);
      return true;
    }
    if (method === "GET") {
      const playbook = await getPlaybook(key);
      if (!playbook) {
        sendNotFound(res);
        return true;
      }
      sendJson(res, 200, { playbook });
      return true;
    }
    if (method === "PUT") {
      const body = await readJsonBody(req, MAX_BODY_BYTES);
      if (!body.ok) {
        sendBadRequest(res, body.error);
        return true;
      }
      const data = body.value as Record<string, unknown>;
      const updated = await updatePlaybook(key, playbookInput(data, str(data.label)));
      if (!updated) {
        sendNotFound(res);
        return true;
      }
      sendJson(res, 200, { playbook: updated });
      return true;
    }
    if (method === "DELETE") {
      await deletePlaybook(key);
      sendJson(res, 200, { ok: true });
      return true;
    }
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }

  // ── The queue ───────────────────────────────────────────────────────────
  if (subPath === "/leads" && method === "GET") {
    await respondWithQueue(res, url);
    return true;
  }

  // A lead taken over the phone. Same row, same trail, source says how it came.
  if (subPath === "/leads" && method === "POST") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const email = str(data.email);
    const phone = str(data.phone);
    if (!email && !phone) {
      sendBadRequest(res, "email or phone required");
      return true;
    }
    const territoryKey = str(data.territoryKey);
    const territory = territoryKey ? await getTerritory(territoryKey) : null;
    const lead = await createLead({
      source: "manual",
      formName: null,
      name: str(data.name),
      email,
      phone,
      company: str(data.company),
      message: str(data.message),
      marketRaw: territory?.label ?? str(data.market),
      territoryKey: territory?.key ?? null,
      ownerName: territory?.ownerName ?? null,
      ownerEmail: territory?.ownerEmail ?? null,
    });
    await addLeadEvent({
      leadId: lead.id,
      kind: "note",
      authorName: ctx.actorName,
      body: "Added by hand in the Hub",
    });
    // A lead typed in by someone who is already looking at the Hub does not
    // email itself: they decide whether the owner needs telling.
    sendJson(res, 201, { lead });
    return true;
  }

  if (!subPath.startsWith("/leads/")) {
    return false;
  }
  const rest = subPath.slice("/leads/".length);
  const [rawId, action] = rest.split("/");
  const id = decodeURIComponent(rawId ?? "");
  if (!id) {
    sendNotFound(res);
    return true;
  }
  const lead = await getLead(id);
  if (!lead) {
    sendNotFound(res);
    return true;
  }

  if (!action && method === "GET") {
    sendJson(res, 200, { lead, events: await listLeadEvents(id) });
    return true;
  }

  if (!action && method === "DELETE") {
    if (!ctx.isAdmin) {
      sendForbidden(res);
      return true;
    }
    await deleteLead(id);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (action === "status" && method === "PUT") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const status = (body.value as Record<string, unknown>).status;
    if (!isLeadStatus(status)) {
      sendBadRequest(res, "unknown status");
      return true;
    }
    const updated = await setLeadStatus(id, status, ctx.actorName);
    sendJson(res, 200, { lead: updated, events: await listLeadEvents(id) });
    return true;
  }

  if (action === "assign" && method === "PUT") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const data = body.value as Record<string, unknown>;
    const territoryKey = str(data.territoryKey);
    const territory = territoryKey ? await getTerritory(territoryKey) : null;
    if (territoryKey && !territory) {
      sendBadRequest(res, "unknown territory");
      return true;
    }
    const updated = await assignLead(
      id,
      {
        territoryKey: territory?.key ?? null,
        ownerName: territory?.ownerName ?? null,
        ownerEmail: territory?.ownerEmail ?? null,
      },
      ctx.actorName,
    );
    sendJson(res, 200, { lead: updated, events: await listLeadEvents(id) });
    return true;
  }

  if (action === "notes" && method === "POST") {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (!body.ok) {
      sendBadRequest(res, body.error);
      return true;
    }
    const note = str((body.value as Record<string, unknown>).body);
    if (!note) {
      sendBadRequest(res, "body required");
      return true;
    }
    await addLeadEvent({ leadId: id, kind: "note", authorName: ctx.actorName, body: note });
    sendJson(res, 201, { events: await listLeadEvents(id) });
    return true;
  }

  // Send the dispatch again — after an address is filled in, or a re-route.
  if (action === "dispatch" && method === "POST") {
    const result = await dispatchLead(lead);
    const updated = await getLead(id);
    sendJson(res, result.ok ? 200 : 502, {
      ok: result.ok,
      detail: result.detail ?? null,
      lead: updated,
      events: await listLeadEvents(id),
    });
    return true;
  }

  sendJson(res, 405, { error: "method_not_allowed" });
  return true;
}
