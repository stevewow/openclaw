import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/provider-web-search";
import { Type } from "typebox";

let clientModule: typeof import("./src/client.js") | undefined;
let configModule: typeof import("./src/config.js") | undefined;

async function loadClient() {
  clientModule ??= await import("./src/client.js");
  return clientModule;
}

async function loadConfig() {
  configModule ??= await import("./src/config.js");
  return configModule;
}

export default definePluginEntry({
  id: "pipedrive",
  name: "Pipedrive CRM",
  description: "Search contacts, activities, deals, and log sales actions in Pipedrive.",

  register(api) {
    api.registerTool(
      {
        name: "pipedrive_search_persons",
        label: "Pipedrive: Search Contacts",
        description:
          "Search for persons (real estate agents or clients) in Pipedrive by name, email, or phone. " +
          "Returns contact details including last activity date and open deal count.",
        parameters: Type.Object(
          {
            term: Type.String({ description: "Name, email, or phone number to search for." }),
            limit: Type.Optional(
              Type.Number({ description: "Max results to return. Defaults to 20." }),
            ),
          },
          { additionalProperties: false },
        ),
        execute: async (_toolCallId: string, rawParams: unknown) => {
          const p = rawParams as Record<string, unknown>;
          const { searchPersons } = await loadClient();
          const result = await searchPersons({
            term: String(p.term ?? ""),
            limit: typeof p.limit === "number" ? p.limit : undefined,
          });
          return jsonResult(result);
        },
      },
      { name: "pipedrive_search_persons" },
    );

    api.registerTool(
      {
        name: "pipedrive_get_activities",
        label: "Pipedrive: Get Activities",
        description:
          "Retrieve call, email, meeting, and task activity records from Pipedrive. " +
          "Filter by user, date range, activity type, completion status, or a specific person or deal. " +
          "Use done=0 for upcoming activities, done=1 for completed.",
        parameters: Type.Object(
          {
            user_id: Type.Optional(
              Type.Number({ description: "Filter by Pipedrive user (sales rep) ID." }),
            ),
            type: Type.Optional(
              Type.String({
                description:
                  'Activity type: "call", "meeting", "email", "task", "deadline", "lunch", "note".',
              }),
            ),
            start_date: Type.Optional(
              Type.String({ description: "Start of date range in YYYY-MM-DD format." }),
            ),
            end_date: Type.Optional(
              Type.String({ description: "End of date range in YYYY-MM-DD format." }),
            ),
            done: Type.Optional(
              Type.Union([Type.Literal(0), Type.Literal(1)], {
                description: "0 = upcoming/incomplete, 1 = completed.",
              }),
            ),
            person_id: Type.Optional(
              Type.Number({ description: "Filter activities for a specific person by ID." }),
            ),
            deal_id: Type.Optional(
              Type.Number({ description: "Filter activities for a specific deal by ID." }),
            ),
            limit: Type.Optional(Type.Number({ description: "Max results. Defaults to 50." })),
          },
          { additionalProperties: false },
        ),
        execute: async (_toolCallId: string, rawParams: unknown) => {
          const p = rawParams as Record<string, unknown>;
          const { getActivities } = await loadClient();
          const result = await getActivities({
            user_id: typeof p.user_id === "number" ? p.user_id : undefined,
            type: typeof p.type === "string" ? p.type : undefined,
            start_date: typeof p.start_date === "string" ? p.start_date : undefined,
            end_date: typeof p.end_date === "string" ? p.end_date : undefined,
            done: p.done === 0 ? 0 : p.done === 1 ? 1 : undefined,
            person_id: typeof p.person_id === "number" ? p.person_id : undefined,
            deal_id: typeof p.deal_id === "number" ? p.deal_id : undefined,
            limit: typeof p.limit === "number" ? p.limit : undefined,
          });
          return jsonResult(result);
        },
      },
      { name: "pipedrive_get_activities" },
    );

    api.registerTool(
      {
        name: "pipedrive_get_deals",
        label: "Pipedrive: Get Deals",
        description:
          "Retrieve deals from the Pipedrive pipeline. Filter by status (open, won, lost), " +
          "assigned user, or pipeline stage.",
        parameters: Type.Object(
          {
            status: Type.Optional(
              Type.Union(
                [
                  Type.Literal("open"),
                  Type.Literal("won"),
                  Type.Literal("lost"),
                  Type.Literal("all_not_deleted"),
                ],
                { description: "Deal status filter. Defaults to open." },
              ),
            ),
            user_id: Type.Optional(
              Type.Number({ description: "Filter by assigned Pipedrive user ID." }),
            ),
            stage_id: Type.Optional(Type.Number({ description: "Filter by pipeline stage ID." })),
            limit: Type.Optional(Type.Number({ description: "Max results. Defaults to 50." })),
          },
          { additionalProperties: false },
        ),
        execute: async (_toolCallId: string, rawParams: unknown) => {
          const p = rawParams as Record<string, unknown>;
          const { getDeals } = await loadClient();
          const result = await getDeals({
            status:
              p.status === "open" ||
              p.status === "won" ||
              p.status === "lost" ||
              p.status === "all_not_deleted"
                ? p.status
                : undefined,
            user_id: typeof p.user_id === "number" ? p.user_id : undefined,
            stage_id: typeof p.stage_id === "number" ? p.stage_id : undefined,
            limit: typeof p.limit === "number" ? p.limit : undefined,
          });
          return jsonResult(result);
        },
      },
      { name: "pipedrive_get_deals" },
    );

    api.registerTool(
      {
        name: "pipedrive_get_stale_contacts",
        label: "Pipedrive: Get Stale Contacts",
        description:
          "Find contacts (real estate agents) who have not had any activity logged in Pipedrive " +
          "within the specified number of days. Use this to surface re-engagement targets.",
        parameters: Type.Object(
          {
            days_since_contact: Type.Number({
              description: "Return contacts with no activity in this many days.",
            }),
            limit: Type.Optional(
              Type.Number({ description: "Max contacts to return. Defaults to 100." }),
            ),
          },
          { additionalProperties: false },
        ),
        execute: async (_toolCallId: string, rawParams: unknown) => {
          const p = rawParams as Record<string, unknown>;
          const { getStaleContacts } = await loadClient();
          const result = await getStaleContacts({
            days_since_contact:
              typeof p.days_since_contact === "number" ? p.days_since_contact : 30,
            limit: typeof p.limit === "number" ? p.limit : undefined,
          });
          return jsonResult(result);
        },
      },
      { name: "pipedrive_get_stale_contacts" },
    );

    api.registerTool(
      {
        name: "pipedrive_add_note",
        label: "Pipedrive: Add Note",
        description:
          "Add a note to a person, deal, or organization in Pipedrive. " +
          "Provide at least one of person_id, deal_id, or org_id.",
        parameters: Type.Object(
          {
            content: Type.String({ description: "The note text to add." }),
            person_id: Type.Optional(
              Type.Number({ description: "Pipedrive person ID to attach the note to." }),
            ),
            deal_id: Type.Optional(
              Type.Number({ description: "Pipedrive deal ID to attach the note to." }),
            ),
            org_id: Type.Optional(
              Type.Number({ description: "Pipedrive organization ID to attach the note to." }),
            ),
          },
          { additionalProperties: false },
        ),
        execute: async (_toolCallId: string, rawParams: unknown) => {
          const p = rawParams as Record<string, unknown>;
          const { addNote } = await loadClient();
          const result = await addNote({
            content: String(p.content ?? ""),
            person_id: typeof p.person_id === "number" ? p.person_id : undefined,
            deal_id: typeof p.deal_id === "number" ? p.deal_id : undefined,
            org_id: typeof p.org_id === "number" ? p.org_id : undefined,
          });
          return jsonResult(result);
        },
      },
      { name: "pipedrive_add_note" },
    );

    api.registerTool(
      {
        name: "pipedrive_add_activity",
        label: "Pipedrive: Log or Schedule Activity",
        description:
          "Log a completed activity (e.g. a call just made) or schedule a future one " +
          "(e.g. a follow-up call). Set done=1 to log as completed, done=0 to schedule. " +
          "Common types: call, meeting, email, task.",
        parameters: Type.Object(
          {
            subject: Type.String({ description: "Activity subject/title." }),
            type: Type.String({
              description: 'Activity type: "call", "meeting", "email", "task", "deadline".',
            }),
            due_date: Type.Optional(Type.String({ description: "Due date in YYYY-MM-DD format." })),
            due_time: Type.Optional(
              Type.String({ description: "Due time in HH:MM format (24h)." }),
            ),
            duration: Type.Optional(
              Type.String({ description: "Duration in HH:MM format, e.g. 00:30 for 30 minutes." }),
            ),
            person_id: Type.Optional(
              Type.Number({ description: "Pipedrive person ID to link this activity to." }),
            ),
            deal_id: Type.Optional(
              Type.Number({ description: "Pipedrive deal ID to link this activity to." }),
            ),
            user_id: Type.Optional(
              Type.Number({
                description: "Assign to a specific Pipedrive user ID. Defaults to token owner.",
              }),
            ),
            note: Type.Optional(
              Type.String({ description: "Additional notes about the activity." }),
            ),
            done: Type.Optional(
              Type.Union([Type.Literal(0), Type.Literal(1)], {
                description: "1 = log as completed, 0 = schedule for future. Defaults to 0.",
              }),
            ),
          },
          { additionalProperties: false },
        ),
        execute: async (_toolCallId: string, rawParams: unknown) => {
          const p = rawParams as Record<string, unknown>;
          const { addActivity } = await loadClient();
          const result = await addActivity({
            subject: String(p.subject ?? ""),
            type: String(p.type ?? "call"),
            due_date: typeof p.due_date === "string" ? p.due_date : undefined,
            due_time: typeof p.due_time === "string" ? p.due_time : undefined,
            duration: typeof p.duration === "string" ? p.duration : undefined,
            person_id: typeof p.person_id === "number" ? p.person_id : undefined,
            deal_id: typeof p.deal_id === "number" ? p.deal_id : undefined,
            user_id: typeof p.user_id === "number" ? p.user_id : undefined,
            note: typeof p.note === "string" ? p.note : undefined,
            done: p.done === 1 ? 1 : 0,
          });
          return jsonResult(result);
        },
      },
      { name: "pipedrive_add_activity" },
    );

    api.registerCommand({
      name: "pipedrive-setup",
      description: "Connect your Pipedrive account by entering your API token.",
      acceptsArgs: true,
      requiredScopes: ["operator.admin"],
      handler: async (args) => {
        const token = typeof args === "string" ? args.trim() : "";
        if (!token) {
          return {
            text: [
              "**Pipedrive Setup**",
              "",
              "Provide your Pipedrive API token as an argument:",
              "  `/pipedrive-setup YOUR_API_TOKEN`",
              "",
              "Find your token at: **Pipedrive → Settings → Personal preferences → API**",
            ].join("\n"),
          };
        }
        const { savePipedriveConfig } = await loadConfig();
        await savePipedriveConfig({ apiToken: token });
        return {
          text: "Pipedrive connected. Sales Bot and Steve Bot now have access to your Pipedrive data.",
        };
      },
    });
  },
});
