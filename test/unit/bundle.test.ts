import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { build } from "esbuild";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs build script without types
import { serverBundleOptions } from "../../scripts/server-bundle.mjs";
import { TOOL_NAMES } from "../../src/shared/protocol.js";

const COMMITTED = "plugin/server.mjs";
const tmp = mkdtempSync(join(tmpdir(), "aiba-bundle-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("plugin/server.mjs", () => {
  it("is exactly what the build produces from the current source", async () => {
    const fresh = join(tmp, "fresh.mjs");
    await build(serverBundleOptions(fresh));
    const same = readFileSync(fresh).equals(readFileSync(COMMITTED));
    expect(same, `${COMMITTED} is out of date: run "npm run build" and commit it`).toBe(true);
  });

  it("runs on its own, without node_modules, and lists the 10 tools", async () => {
    const home = join(tmp, "home");
    // The temp dir is outside the project, so no node_modules can be found from it.
    copyFileSync(COMMITTED, join(tmp, "server.mjs"));
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(tmp, "server.mjs")],
      cwd: tmp,
      env: { ...process.env, AI_BROWSER_HOME: home, AI_BROWSER_PORT: "18799" } as Record<string, string>,
      stderr: "ignore",
    });
    const client = new Client({ name: "bundle-test", version: "0" });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    } finally {
      await client.close();
    }
  });
});
