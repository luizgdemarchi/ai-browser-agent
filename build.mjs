import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { serverBundleOptions } from "./scripts/server-bundle.mjs";

const ext = "src/extension";
const out = "dist/extension";

rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/server/index.ts"],
  outfile: "dist/server/index.js",
  platform: "node",
  format: "esm",
  target: "node20",
  bundle: true,
  packages: "external",
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "warning",
});

await build({
  entryPoints: [`${ext}/background.ts`],
  outfile: `${out}/background.js`,
  platform: "browser",
  format: "esm",
  target: "chrome116",
  bundle: true,
  logLevel: "warning",
});

await build({
  entryPoints: ["offscreen", "popup", "options", "reader"].map((n) => `${ext}/${n}.ts`),
  outdir: out,
  platform: "browser",
  format: "iife",
  target: "chrome116",
  bundle: true,
  logLevel: "warning",
});

mkdirSync(out, { recursive: true });
for (const f of readdirSync(ext)) {
  if (f === "manifest.json" || f.endsWith(".html") || f.endsWith(".css")) {
    cpSync(join(ext, f), join(out, f));
  }
}
if (existsSync(`${ext}/icons`)) cpSync(`${ext}/icons`, `${out}/icons`, { recursive: true });

// Committed single-file server for the Claude Code and Codex plugins.
await build(serverBundleOptions("plugin/server.mjs"));
