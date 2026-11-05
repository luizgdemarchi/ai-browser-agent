// Real browser input and screenshots through chrome.debugger (Chrome DevTools Protocol).
import { ToolError } from "../shared/protocol.js";

const PROTOCOL_VERSION = "1.3";
const attached = new Set<number>();

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId !== undefined) attached.delete(source.tabId);
});

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
}

async function send<T = unknown>(tabId: number, method: string, params?: object): Promise<T> {
  await ensureAttached(tabId);
  try {
    return (await chrome.debugger.sendCommand({ tabId }, method, params)) as T;
  } catch (error) {
    throw mapChromeError(error);
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
