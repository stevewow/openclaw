#!/usr/bin/env node
import fs from "fs";
import path from "path";
/**
 * Build the spiro plugin into dist/extensions/spiro/index.js using esbuild.
 * Bundles all non-Node.js dependencies including openclaw/plugin-sdk/* stubs.
 */
import { build } from "/root/openclaw/node_modules/esbuild/lib/main.js";

const ROOT = "/root/openclaw";
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const exports_ = pkg.exports;

// Build aliases: "openclaw/plugin-sdk/X" -> "/root/openclaw/dist/plugin-sdk/X.js"
const alias = {};
for (const [key, val] of Object.entries(exports_)) {
  if (!key.startsWith("./plugin-sdk/")) continue; // only plugin-sdk subpaths
  const importPath = "openclaw/" + key.slice(2); // "./plugin-sdk/X" -> "openclaw/plugin-sdk/X"
  const resolved = typeof val === "string" ? val : (val?.default ?? null);
  if (resolved && importPath !== "openclaw/") {
    alias[importPath] = path.resolve(ROOT, resolved);
  }
}

const outDir = path.join(ROOT, "dist/extensions/spiro");
fs.mkdirSync(outDir, { recursive: true });

const result = await build({
  entryPoints: [path.join(ROOT, "extensions/spiro/index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  outfile: path.join(outDir, "index.js"),
  alias,
  // Mark all node:* builtins as external
  external: [
    "node:*",
    "fs",
    "path",
    "http",
    "https",
    "crypto",
    "url",
    "os",
    "stream",
    "buffer",
    "util",
    "events",
    "net",
    "tls",
    "zlib",
    "child_process",
    "worker_threads",
    "readline",
    "string_decoder",
    "querystring",
  ],
  logLevel: "info",
});

if (result.errors.length > 0) {
  console.error("Build errors:", result.errors);
  process.exit(1);
}

// Write a minimal openclaw.plugin.json next to the bundle
const manifest = {
  id: "spiro",
  activation: { onStartup: true },
  enabledByDefault: false,
  configSchema: { type: "object", additionalProperties: false, properties: {} },
};
fs.writeFileSync(path.join(outDir, "openclaw.plugin.json"), JSON.stringify(manifest, null, 2));

// Also write a package.json so the plugin is discoverable
const pluginPkg = {
  name: "@openclaw/spiro-plugin",
  version: "2026.6.25-beta.1",
  private: true,
  type: "module",
  openclaw: { extensions: ["./index.js"] },
};
fs.writeFileSync(path.join(outDir, "package.json"), JSON.stringify(pluginPkg, null, 2));

console.log("Built spiro plugin to", outDir);
