// Public barrel for the Spiro plugin. Core code (e.g. the admin dashboard's
// reports feature) must import from here rather than reaching into ./src/**.
export { listTools, callTool, type McpTool } from "./src/client.js";
export { beginAuth, getConnection, type SpiroConnection } from "./src/connect.js";
