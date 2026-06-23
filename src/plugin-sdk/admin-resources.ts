// SDK barrel: exposes admin resource store read API for plugin use.
// Write operations (create/update/delete) are intentionally excluded —
// plugins read resources, they do not manage them.
export type {
  Resource,
  ResourceType,
  ListResourcesOptions,
} from "../gateway/admin/resource-store.js";
export {
  listResources,
  getResource,
  resolveResourceFilePath,
} from "../gateway/admin/resource-store.js";
