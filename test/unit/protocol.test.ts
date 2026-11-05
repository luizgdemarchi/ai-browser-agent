import { describe, expect, it } from "vitest";
import { ERROR_CODES, formatError, ToolError } from "../../src/shared/protocol.js";

describe("protocol", () => {
  it("formats errors with the code prefix", () => {
    expect(formatError("EXTENSION_OFF", "msg")).toBe("[EXTENSION_OFF] msg");
  });
  it("has exactly the error codes from the spec", () => {
    expect([...ERROR_CODES].sort()).toEqual(
      [
        "NOT_CONNECTED",
        "EXTENSION_OFF",
        "DOMAIN_BLOCKED",
        "ELEMENT_NOT_FOUND",
        "TAB_NOT_FOUND",
        "TIMEOUT",
        "UNSUPPORTED_PAGE",
      ].sort(),
    );
  });
  it("ToolError carries its code and a prefixed message", () => {
    const e = new ToolError("TIMEOUT", "too slow");
    expect(e.code).toBe("TIMEOUT");
    expect(e.message).toBe("[TIMEOUT] too slow");
  });
});
