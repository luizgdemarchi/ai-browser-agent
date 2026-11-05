export const ERROR_CODES = [
  "NOT_CONNECTED",
  "EXTENSION_OFF",
  "DOMAIN_BLOCKED",
  "ELEMENT_NOT_FOUND",
  "TAB_NOT_FOUND",
  "TIMEOUT",
  "UNSUPPORTED_PAGE",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const TOOL_NAMES = [
  "read_page",
  "click",
  "type",
  "fill_form",
  "navigate",
  "list_tabs",
  "switch_tab",
  "new_tab",
  "close_tab",
  "screenshot",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export type Role = "extension" | "relay";

export interface HelloMessage {
  type: "hello";
  role: Role;
  token: string;
}
export interface WelcomeMessage {
  type: "welcome";
}
export interface CommandMessage {
  type: "command";
  id: string;
  tool: ToolName;
  args: Record<string, unknown>;
}
export type ResultMessage =
  | { type: "result"; id: string; ok: true; data: unknown }
  | { type: "result"; id: string; ok: false; error: { code: ErrorCode; message: string } };

export type WireMessage = HelloMessage | WelcomeMessage | CommandMessage | ResultMessage;

/** WebSocket close code for failed authentication. */
export const CLOSE_UNAUTHORIZED = 4401;

export function formatError(code: ErrorCode, message: string): string {
  return `[${code}] ${message}`;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

export class ToolError extends Error {
  readonly code: ErrorCode;
  /** Message without the code prefix. */
  readonly detail: string;

  constructor(code: ErrorCode, detail: string) {
    super(formatError(code, detail));
    this.name = "ToolError";
    this.code = code;
    this.detail = detail;
  }
}
