// Real browser input and screenshots through chrome.debugger (Chrome DevTools Protocol).
import { ToolError } from "../shared/protocol.js";

const PROTOCOL_VERSION = "1.3";
const COMMAND_TIMEOUT_MS = 20_000;
const attached = new Set<number>();

export interface DialogInfo {
  type: string;
  message: string;
  /** What the extension did: alert and beforeunload are accepted, confirm and prompt dismissed. */
  handled: "accepted" | "dismissed";
}
/** JavaScript dialogs (alert/confirm/prompt/beforeunload) opened per tab since the last take. */
const dialogs = new Map<number, DialogInfo[]>();
/** Agent actions running per tab. Dialogs outside them belong to the user and are left alone. */
const acting = new Map<number, number>();

/** Runs an agent action on a tab, so dialogs it opens are handled and reported. */
export async function asAgent<T>(tabId: number, fn: () => Promise<T>): Promise<T> {
  acting.set(tabId, (acting.get(tabId) ?? 0) + 1);
  try {
    return await fn();
  } finally {
    // Dialogs can open right after the input event; keep handling them for a moment.
    setTimeout(() => {
      const n = (acting.get(tabId) ?? 1) - 1;
      if (n > 0) acting.set(tabId, n);
      else acting.delete(tabId);
    }, 1000);
  }
}

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId !== undefined) attached.delete(source.tabId);
});

// A modal dialog opened by an agent action blocks every later CDP command on the tab, so
// close it right away: OK on alerts and on "leave page?" (the agent asked to leave), Cancel
// on confirm and prompt (never agree to something on the user's behalf). The agent sees what
// happened in the tool result. Dialogs outside agent actions are the user's.
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method !== "Page.javascriptDialogOpening" || source.tabId === undefined) return;
  if (!acting.has(source.tabId)) return;
  const { type, message } = params as { type: string; message: string };
  const accept = type === "alert" || type === "beforeunload";
  const list = dialogs.get(source.tabId) ?? [];
  list.push({ type, message: String(message).slice(0, 500), handled: accept ? "accepted" : "dismissed" });
  dialogs.set(source.tabId, list);
  void chrome.debugger.sendCommand(source, "Page.handleJavaScriptDialog", { accept }).catch(() => {});
});

export function takeDialogs(tabId: number): DialogInfo[] {
  const list = dialogs.get(tabId) ?? [];
  dialogs.delete(tabId);
  return list;
}

export function mapChromeError(error: unknown): ToolError {
  if (error instanceof ToolError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/no tab with (given )?id|no tab with id|tab .*not found|invalid tab/i.test(message)) {
    return new ToolError("TAB_NOT_FOUND", "That tab does not exist anymore. Call list_tabs to see the open tabs.");
  }
  return new ToolError("UNSUPPORTED_PAGE", `The browser refused the action on this page: ${message}`);
}

export async function ensureAttached(tabId: number): Promise<void> {
  const targets = await chrome.debugger.getTargets();
  const target = targets.find((t) => t.tabId === tabId);
  if (!target) throw new ToolError("TAB_NOT_FOUND", `Tab ${tabId} does not exist. Call list_tabs to see the open tabs.`);
  if (attached.has(tabId) && target.attached) return;
  try {
    await chrome.debugger.attach({ tabId }, PROTOCOL_VERSION);
  } catch (error) {
    // Already attached by us (for example after the service worker restarted) is fine.
    if (!/already attached/i.test(String((error as Error)?.message))) throw mapChromeError(error);
  }
  attached.add(tabId);
  await chrome.debugger.sendCommand({ tabId }, "Page.enable").catch(() => {});
}

async function send<T = unknown>(tabId: number, method: string, params?: object): Promise<T> {
  await ensureAttached(tabId);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ToolError("TIMEOUT", `The page did not respond to ${method} in ${COMMAND_TIMEOUT_MS / 1000} s.`)),
      COMMAND_TIMEOUT_MS,
    );
  });
  try {
    return (await Promise.race([chrome.debugger.sendCommand({ tabId }, method, params), timeout])) as T;
  } catch (error) {
    throw mapChromeError(error);
  } finally {
    clearTimeout(timer);
  }
}

export async function detachAll(): Promise<void> {
  const targets = await chrome.debugger.getTargets();
  const ours = new Set(attached);
  for (const t of targets) if (t.attached && t.tabId !== undefined) ours.add(t.tabId);
  await Promise.all(
    [...ours].map((tabId) => chrome.debugger.detach({ tabId }).catch(() => {})),
  );
  attached.clear();
}

/** x and y are CSS pixels in the top frame's viewport. */
export async function click(tabId: number, x: number, y: number): Promise<void> {
  const zoom = await chrome.tabs.getZoom(tabId).catch(() => 1);
  const px = x * zoom;
  const py = y * zoom;
  await send(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x: px, y: py, button: "none" });
  await send(tabId, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: px,
    y: py,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await send(tabId, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: px,
    y: py,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
}

export async function insertText(tabId: number, text: string): Promise<void> {
  await send(tabId, "Input.insertText", { text });
}

const KEYS = {
  Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
  Backspace: { key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 },
} as const;

export async function pressKey(tabId: number, name: keyof typeof KEYS): Promise<void> {
  const key = KEYS[name];
  await send(tabId, "Input.dispatchKeyEvent", { type: "text" in key ? "keyDown" : "rawKeyDown", ...key });
  await send(tabId, "Input.dispatchKeyEvent", {
    type: "keyUp",
    key: key.key,
    code: key.code,
    windowsVirtualKeyCode: key.windowsVirtualKeyCode,
  });
}

/** PNG of the visible area, base64. */
export async function screenshot(tabId: number): Promise<string> {
  const { data } = await send<{ data: string }>(tabId, "Page.captureScreenshot", { format: "png" });
  return data;
}
