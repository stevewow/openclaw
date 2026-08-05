// Public barrel for the Pipedrive plugin. Core code (the admin dashboard's
// last-contact join) must import from here rather than reaching into ./src/**.
//
// Read-only surface only: the dashboard reads when a client was last touched,
// it never writes back into the CRM.
export {
  isConfigured,
  listActivities,
  type ListPageParams,
  listMailThreads,
  listOrganizations,
  listPersons,
  type MailFolder,
} from "./src/client.js";
