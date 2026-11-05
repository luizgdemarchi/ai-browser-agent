import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VERSION } from "../../src/shared/version.js";

const MANIFESTS = [
  "package.json",
  "src/extension/manifest.json",
  ".claude-plugin/plugin.json",
  ".codex-plugin/plugin.json",
];

describe("version", () => {
  it.each(MANIFESTS)("%s has the same version as src/shared/version.ts", (file) => {
    const { version } = JSON.parse(readFileSync(file, "utf8"));
    expect(version, `${file} must be ${VERSION}; bump every manifest together`).toBe(VERSION);
  });
});
