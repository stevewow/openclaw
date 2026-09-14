// Public barrel for the Pipedrive plugin. Core code (the admin dashboard's
// last-contact join, and the lead queue's CRM sync) must import from here
// rather than reaching into ./src/**.
//
// Mostly read-only. The writing surface is deliberately narrow: a lead can
// create the person and the brokerage it names and hang one activity on them,
// and it can do nothing else. Nothing here updates or deletes a record — what a
// rep typed into the CRM is not a website form's to overwrite.
export {
  type CreateOrganizationParams,
  type CreatePersonParams,
  createActivity,
  createOrganization,
  createPerson,
  findPersons,
  isConfigured,
  listActivities,
  type ListPageParams,
  listMailThreads,
  listOrganizations,
  listPersons,
  listUsers,
  type ListUsersResult,
  type MailFolder,
  type SearchHit,
  searchOrganizations,
  type SearchPersonHit,
} from "./src/client.js";
