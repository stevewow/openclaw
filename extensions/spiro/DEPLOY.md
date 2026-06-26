# Spiro Plugin Deployment

The spiro plugin source lives in `extensions/spiro/` but the gateway runs from
`dist/extensions/spiro/` inside the Docker container.

## Rebuild and redeploy after changes

```bash
# From /root/openclaw
node /tmp/.../scratchpad/build-spiro.mjs   # or recreate the script below
docker cp dist/extensions/spiro openclaw-openclaw-gateway-1:/app/dist/extensions/spiro
docker restart openclaw-openclaw-gateway-1
```

## Build script

Save as `scripts/build-spiro.mjs` or run inline:

```js
import { build } from "/root/openclaw/node_modules/esbuild/lib/main.js";
import fs from "fs";
import path from "path";

const ROOT = "/root/openclaw";
const pkg = JSON.parse(fs.readFileSync(`${ROOT}/package.json`, "utf8"));
const alias = {};
for (const [k, v] of Object.entries(pkg.exports)) {
  if (!k.startsWith("./plugin-sdk/")) continue;
  const resolved = typeof v === "string" ? v : v?.default;
  if (resolved) alias["openclaw/" + k.slice(2)] = path.resolve(ROOT, resolved);
}

const outDir = `${ROOT}/dist/extensions/spiro`;
fs.mkdirSync(outDir, { recursive: true });
await build({
  entryPoints: [`${ROOT}/extensions/spiro/index.ts`],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  outfile: `${outDir}/index.js`,
  alias,
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
fs.copyFileSync(`${ROOT}/extensions/spiro/openclaw.plugin.json`, `${outDir}/openclaw.plugin.json`);
const pkgJson = {
  name: "@openclaw/spiro-plugin",
  version: "2026.6.25-beta.1",
  private: true,
  type: "module",
  openclaw: { extensions: ["./index.js"] },
};
fs.writeFileSync(`${outDir}/package.json`, JSON.stringify(pkgJson, null, 2));
console.log("Done:", outDir);
```

## Auth

Run `/spiro-auth` in any OpenClaw chat session (requires operator.admin scope).
Tokens are saved to `~/.openclaw/credentials/spiro.json`.
