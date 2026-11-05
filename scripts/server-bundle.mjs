// esbuild options for plugin/server.mjs: the MCP server in one file, dependencies included,
// so the plugin runs right after install with no npm install. test/unit/bundle.test.ts
// rebuilds with these options and compares the result with the committed file.
export function serverBundleOptions(outfile) {
  return {
    entryPoints: ["src/server/index.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    legalComments: "none",
    charset: "utf8",
    logLevel: "warning",
    banner: {
      // CommonJS dependencies (ws) call require(); give the ESM bundle one.
      js: '#!/usr/bin/env node\nimport { createRequire as __aibaCreateRequire } from "node:module";\nconst require = __aibaCreateRequire(import.meta.url);',
    },
  };
}
