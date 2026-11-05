import { describe, expect, it } from "vitest";
import { createHandlers } from "../../src/server/tools.js";
import { TOOL_NAMES, ToolError } from "../../src/shared/protocol.js";

describe("MCP tool handlers", () => {
  it("covers every tool", () => {
    expect(Object.keys(createHandlers(async () => null)).sort()).toEqual([...TOOL_NAMES].sort());
  });

  it("returns screenshots as MCP image content", async () => {
    const handlers = createHandlers(async () => ({ tabId: 1, data: "iVBORw0K", mimeType: "image/png" }));
    const result = await handlers.screenshot.run({});
    expect(result.content).toEqual([{ type: "image", data: "iVBORw0K", mimeType: "image/png" }]);
    expect(result.isError).toBeFalsy();
  });

  it("returns other results as JSON text", async () => {
    const handlers = createHandlers(async (tool) => ({ echo: tool }));
    const result = await handlers.list_tabs.run({});
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify({ echo: "list_tabs" }, null, 2) }]);
  });

  it("turns ToolError into an MCP error with the code prefix", async () => {
    const handlers = createHandlers(async () => {
      throw new ToolError("DOMAIN_BLOCKED", "bb.com.br is blocked.");
    });
    const result = await handlers.read_page.run({});
    expect(result).toEqual({ isError: true, content: [{ type: "text", text: "[DOMAIN_BLOCKED] bb.com.br is blocked." }] });
  });

  it("refuses navigate with both url and action", async () => {
    let called = false;
    const handlers = createHandlers(async () => {
      called = true;
      return null;
    });
    const result = await handlers.navigate.run({ url: "https://x.com", action: "back" });
    expect(result.isError).toBe(true);
    expect(called).toBe(false);
  });
});
