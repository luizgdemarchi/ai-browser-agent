import { ToolError, type ToolName } from "../shared/protocol.js";
import { runTool } from "./actions.js";
import { detachAll } from "./cdp.js";
import { getSettings, setSession, updateBadge } from "./state.js";

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: "Keep the connection to the local MCP server open.",
    });
  } catch (error) {
    if (!/single offscreen/i.test(String((error as Error)?.message))) throw error;
  }
}

type CommandResult = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string } };

async function handleCommand(tool: ToolName, args: Record<string, unknown>): Promise<CommandResult> {
  const { enabled } = await getSettings();
  if (!enabled) {
    return {
      ok: false,
      error: {
        code: "EXTENSION_OFF",
        message: "The user has turned the AI Browser Agent extension off. Ask them to turn it on in the extension popup.",
      },
    };
  }
  try {
    const { data, target } = await runTool(tool, args);
    await setSession({ lastAction: { tool, target, at: Date.now() } });
    return { ok: true, data };
  } catch (error) {
    const e = error instanceof ToolError ? error : new ToolError("UNSUPPORTED_PAGE", String(error));
    return { ok: false, error: { code: e.code, message: e.detail } };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  switch (msg?.type) {
    case "get-settings":
      void getSettings().then(({ token, port }) => sendResponse({ token, port }));
      return true;
    case "connection":
      void setSession({ connected: !!msg.connected, authFailed: !!msg.authFailed }).then(updateBadge);
      return;
    case "settings-changed":
      void (async () => {
        const { enabled } = await getSettings();
        if (!enabled) await detachAll();
        await ensureOffscreen();
        await updateBadge();
      })();
      return;
    case "command":
      void handleCommand(msg.tool, msg.args ?? {}).then(sendResponse);
      return true;
  }
});

chrome.runtime.onStartup.addListener(() => void ensureOffscreen());
chrome.runtime.onInstalled.addListener(() => void ensureOffscreen());
void ensureOffscreen();
void updateBadge();
