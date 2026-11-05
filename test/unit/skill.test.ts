import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ERROR_CODES, TOOL_NAMES } from "../../src/shared/protocol.js";

const skill = readFileSync("skills/browser/SKILL.md", "utf8");

describe("skills/browser/SKILL.md", () => {
  it("has Agent Skills frontmatter with name and description", () => {
    const front = skill.match(/^---\n([\s\S]*?)\n---\n/);
    expect(front, "missing frontmatter").not.toBeNull();
    expect(front![1]).toMatch(/^name: browser$/m);
    expect(front![1]).toMatch(/^description: .{40,}$/m);
  });

  it.each([...ERROR_CODES])("explains the error code %s", (code) => {
    expect(skill).toContain(code);
  });

  it.each([...TOOL_NAMES])("mentions the tool %s", (tool) => {
    expect(skill).toContain(`\`${tool}\``);
  });

  it("never tells the agent to read the token file", () => {
    expect(skill).toMatch(/never (read|open|print|show)[^.\n]*token/i);
  });
});
