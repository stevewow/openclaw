#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { build } from "/root/openclaw/node_modules/esbuild/lib/main.js";

const ROOT = "/root/openclaw";
const outDir = path.join(ROOT, "dist/extensions/spiro");
fs.mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(ROOT, "extensions/spiro/index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  outfile: path.join(outDir, "index.js"),
  // Only Node.js built-ins are external; everything else (typebox) bundles in.
  // No openclaw/* imports exist in this plugin — pure Node.js only.
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
  ],
  logLevel: "info",
});

fs.copyFileSync(
  path.join(ROOT, "extensions/spiro/openclaw.plugin.json"),
  path.join(outDir, "openclaw.plugin.json"),
);
fs.writeFileSync(
  path.join(outDir, "package.json"),
  JSON.stringify(
    {
      name: "@openclaw/spiro-plugin",
      version: "2026.6.29-beta.2",
      private: true,
      type: "module",
      openclaw: { extensions: ["./index.js"] },
    },
    null,
    2,
  ),
);

console.log(
  "Done:",
  outDir,
  `(${Math.round(fs.statSync(path.join(outDir, "index.js")).size / 1024)}KB)`,
);
