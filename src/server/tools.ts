import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { formatError, ToolError, type ToolName } from "../shared/protocol.js";

export type Send = (tool: ToolName, args: Record<string, unknown>) => Promise<unknown>;

const tabId = z.number().int().optional().describe("Tab id from list_tabs. Defaults to the active tab.");
const index = z.number().int().min(1).describe("Element number from the last read_page of this tab.");

const DEFINITIONS = {
  read_page: {
    description:
      "Read the current page: URL, title, visible text and a numbered list of the visible interactive elements. " +
      "The numbers are valid until the next read_page or navigation of that tab.",
    schema: { tabId },
  },
  click: {
    description: "Click an element by its number from read_page, as a real mouse click. Call read_page first. " +
      "JavaScript dialogs the click opens are closed (alert: OK, confirm/prompt: Cancel) and listed in the result.",
    schema: { index, tabId },
  },
  type: {
    description:
      "Type text into a field by its number from read_page, as real keyboard input. Call read_page first. " +
      "clear (default true) replaces the current content; submit presses Enter after typing.",
    schema: {
      index,
      text: z.string(),
      clear: z.boolean().optional(),
      submit: z.boolean().optional(),
      tabId,
    },
  },
  fill_form: {
    description:
      "Fill several fields in one call. Call read_page first. Text fields get the string, selects get an option " +
      "value or visible text, checkboxes and radios get true or false.",
    schema: {
      fields: z.array(z.object({ index, value: z.union([z.string(), z.boolean()]) })).min(1),
      tabId,
    },
  },
  navigate: {
    description:
      "Open a URL in the tab, or go back, forward or reload. Pass exactly one of url or action. " +
      "Only http(s) and about:blank; https:// is added when the scheme is missing. " +
      "Returns when the page finishes loading (up to 30 s).",
    schema: {
      url: z.string().optional(),
      action: z.enum(["back", "forward", "reload"]).optional(),
      tabId,
    },
  },
  list_tabs: {
    description: "List all open tabs with id, title, URL, whether it is active and its window id.",
    schema: {},
  },
  switch_tab: {
    description: "Activate a tab and focus its window.",
    schema: { tabId: z.number().int() },
  },
  new_tab: {
    description: "Open a new active tab, optionally at an http(s) URL, and wait for it to load.",
    schema: { url: z.string().optional() },
  },
  close_tab: {
    description: "Close a tab.",
    schema: { tabId: z.number().int() },
  },
  screenshot: {
    description: "Take a PNG screenshot of the visible area of the tab. A background tab is activated first (hidden tabs are not painted).",
    schema: { tabId },
  },
} satisfies Record<ToolName, { description: string; schema: z.ZodRawShape }>;

function errorResult(text: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text }] };
}

export interface Handler {
  description: string;
  schema: z.ZodRawShape;
  run(args: Record<string, unknown>): Promise<CallToolResult>;
}

export function createHandlers(send: Send): Record<ToolName, Handler> {
  const entries = (Object.keys(DEFINITIONS) as ToolName[]).map((tool) => {
    const { description, schema } = DEFINITIONS[tool];
    const handler: Handler = {
      description,
      schema,
      async run(args) {
        if (tool === "navigate" && (args.url === undefined) === (args.action === undefined)) {
          return errorResult(formatError("UNSUPPORTED_PAGE", "navigate needs exactly one of url or action."));
        }
        try {
          const data = await send(tool, args);
          if (tool === "screenshot") {
            const shot = data as { data: string; mimeType?: string };
            return { content: [{ type: "image", data: shot.data, mimeType: shot.mimeType ?? "image/png" }] };
          }
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        } catch (error) {
          if (error instanceof ToolError) return errorResult(error.message);
          return errorResult(String((error as Error)?.message ?? error));
        }
      },
    };
    return [tool, handler] as const;
  });
  return Object.fromEntries(entries) as Record<ToolName, Handler>;
}

export function registerTools(server: McpServer, send: Send): void {
  for (const [name, handler] of Object.entries(createHandlers(send))) {
    server.registerTool(name, { description: handler.description, inputSchema: handler.schema }, (args) =>
      handler.run(args as Record<string, unknown>),
    );
  }
}
