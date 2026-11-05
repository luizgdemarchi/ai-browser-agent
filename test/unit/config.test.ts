import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/server/config.js";

describe("loadConfig", () => {
  let home: string;
  const env = { ...process.env };

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "aiba-cfg-"));
    process.env.AI_BROWSER_HOME = home;
    delete process.env.AI_BROWSER_PORT;
  });
  afterEach(() => {
    process.env = { ...env };
    rmSync(home, { recursive: true, force: true });
  });

  it("creates a 64-char hex token and reuses it", () => {
    const a = loadConfig();
    expect(a.token).toMatch(/^[0-9a-f]{64}$/);
    expect(readFileSync(join(home, "token"), "utf8").trim()).toBe(a.token);
    expect(loadConfig().token).toBe(a.token);
    expect(a.home).toBe(home);
  });

  it("uses port 8765 by default and AI_BROWSER_PORT when set", () => {
    expect(loadConfig().port).toBe(8765);
    process.env.AI_BROWSER_PORT = "18765";
    expect(loadConfig().port).toBe(18765);
  });

  it("rejects an invalid AI_BROWSER_PORT", () => {
    process.env.AI_BROWSER_PORT = "abc";
    expect(() => loadConfig()).toThrow(/AI_BROWSER_PORT/);
  });
});
