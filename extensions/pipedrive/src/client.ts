import { PIPEDRIVE_BASE_URL, loadPipedriveConfig } from "./config.js";

function getToken(): string {
  const config = loadPipedriveConfig();
  if (!config?.apiToken) {
    throw new Error(
      "Pipedrive is not configured. Run /pipedrive-setup in chat and enter your API token.",
    );
  }
  return config.apiToken;
}

async function pipedriveGet(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<unknown> {
  const token = getToken();
  const qs = new URLSearchParams({ api_token: token });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const url = `${PIPEDRIVE_BASE_URL}${path}?${qs}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Pipedrive API error: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { success: boolean; data: unknown; additional_data?: unknown };
  if (!json.success) {
    throw new Error(`Pipedrive API returned success=false for ${path}`);
  }
  return json.data;
}

async function pipedrivePost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const token = getToken();
  const url = `${PIPEDRIVE_BASE_URL}${path}?api_token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Pipedrive API error: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { success: boolean; data: unknown };
  if (!json.success) {
    throw new Error(`Pipedrive API returned success=false for POST ${path}`);
  }
  return json.data;
}

export type SearchPersonsParams = {
  term: string;
  fields?: string;
  limit?: number;
};

export async function searchPersons(params: SearchPersonsParams): Promise<unknown> {
  return pipedriveGet("/persons/search", {
    term: params.term,
    fields: params.fields ?? "name,phone,email,organization",
    limit: params.limit ?? 20,
    include_fields: "person.last_activity_date,person.open_deals_count",
  });
}

export type GetActivitiesParams = {
  user_id?: number;
  type?: string;
  start_date?: string;
  end_date?: string;
  done?: 0 | 1;
  limit?: number;
  person_id?: number;
  deal_id?: number;
};

export async function getActivities(params: GetActivitiesParams): Promise<unknown> {
  if (params.person_id) {
    return pipedriveGet(`/persons/${params.person_id}/activities`, {
      start: 0,
      limit: params.limit ?? 50,
      done: params.done,
    });
  }
  return pipedriveGet("/activities", {
    user_id: params.user_id,
    type: params.type,
    start_date: params.start_date,
    end_date: params.end_date,
    done: params.done,
    start: 0,
    limit: params.limit ?? 50,
  });
}

export type GetDealsParams = {
  status?: "open" | "won" | "lost" | "all_not_deleted";
  user_id?: number;
  stage_id?: number;
  limit?: number;
};

export async function getDeals(params: GetDealsParams): Promise<unknown> {
  return pipedriveGet("/deals", {
    status: params.status ?? "open",
    user_id: params.user_id,
    stage_id: params.stage_id,
    start: 0,
    limit: params.limit ?? 50,
  });
}

export type GetStaleContactsParams = {
  days_since_contact: number;
  limit?: number;
};

export async function getStaleContacts(params: GetStaleContactsParams): Promise<unknown> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - params.days_since_contact);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const data = (await pipedriveGet("/persons", {
    start: 0,
    limit: params.limit ?? 100,
    sort: "last_activity_date ASC",
  })) as Array<Record<string, unknown>>;

  if (!Array.isArray(data)) return [];

  return data.filter((p) => {
    const lastActivity = p["last_activity_date"] as string | null;
    if (!lastActivity) return true;
    return lastActivity <= cutoffStr;
  });
}

export type AddNoteParams = {
  content: string;
  person_id?: number;
  deal_id?: number;
  org_id?: number;
};

export async function addNote(params: AddNoteParams): Promise<unknown> {
  if (!params.person_id && !params.deal_id && !params.org_id) {
    throw new Error("At least one of person_id, deal_id, or org_id is required.");
  }
  return pipedrivePost("/notes", {
    content: params.content,
    person_id: params.person_id,
    deal_id: params.deal_id,
    org_id: params.org_id,
  });
}

export type AddActivityParams = {
  subject: string;
  type: string;
  due_date?: string;
  due_time?: string;
  duration?: string;
  person_id?: number;
  deal_id?: number;
  user_id?: number;
  note?: string;
  done?: 0 | 1;
};

export async function addActivity(params: AddActivityParams): Promise<unknown> {
  return pipedrivePost("/activities", {
    subject: params.subject,
    type: params.type,
    due_date: params.due_date,
    due_time: params.due_time,
    duration: params.duration,
    person_id: params.person_id,
    deal_id: params.deal_id,
    user_id: params.user_id,
    note: params.note,
    done: params.done,
  });
}
