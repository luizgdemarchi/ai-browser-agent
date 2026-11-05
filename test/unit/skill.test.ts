import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ERROR_CODES, TOOL_NAMES } from "../../src/shared/protocol.js";

const skill = readFileSync("skills/browser/SKILL.md", "utf8");

/** The row of the error-code table for one code. */
function errorRow(code: string): string {
  return skill.split("\n").find((line) => line.startsWith(`| \`${code}\``)) ?? "";
}

describe("skills/browser/SKILL.md", () => {
  it("has Agent Skills frontmatter with name and description", () => {
    const front = skill.match(/^---\n([\s\S]*?)\n---\n/);
    expect(front, "missing frontmatter").not.toBeNull();
    expect(front![1]).toMatch(/^name: browser$/m);
    expect(front![1]).toMatch(/^description: .{40,}$/m);
  });

  it.each([...ERROR_CODES])("explains the error code %s", (code) => {
    expect(errorRow(code), `no row for ${code} in the error-code table`).not.toBe("");
  });

  it.each([...TOOL_NAMES])("mentions the tool %s", (tool) => {
    expect(skill).toContain(`\`${tool}\``);
  });

  it("never tells the agent to read the token file", () => {
    expect(skill).toMatch(/never (read|open|print|show)[^.\n]*token/i);
  });

  it("does not send an already paired user to reinstall on every NOT_CONNECTED", () => {
    const row = errorRow("NOT_CONNECTED");
    expect(row).toMatch(/read the (error )?message/i);
    expect(row).toMatch(/Try again/);
  });

  it("tells the agent to use the options listed in an ELEMENT_NOT_FOUND message", () => {
    expect(errorRow("ELEMENT_NOT_FOUND")).toMatch(/option/i);
  });

  it("forbids repeating an irreversible action after a TIMEOUT", () => {
    expect(errorRow("TIMEOUT")).toMatch(/never (retry|repeat)/i);
  });
});
