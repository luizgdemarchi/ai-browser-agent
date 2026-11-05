// The MCP tools, as run inside the extension.
import { isBlocked } from "../shared/blocklist.js";
import { ToolError, type ToolName } from "../shared/protocol.js";
import * as cdp from "./cdp.js";
import type { PageSnapshot, ReaderApi } from "./reader.js";
import { getSettings } from "./state.js";

const LOAD_TIMEOUT_MS = 30_000;

type Args = Record<string, unknown>;

export interface ToolOutcome {
  data: unknown;
  /** Short description of the target, for the popup's "last action". */
  target: string;
}

const UNSUPPORTED = [
  /^chrome:/i,
  /^chrome-extension:/i,
  /^chrome-untrusted:/i,
  /^devtools:/i,
  /^edge:/i,
  /^view-source:/i,
  /^https:\/\/chrome\.google\.com\/webstore/i,
  /^https:\/\/chromewebstore\.google\.com/i,
];

async function checkUrl(url: string | undefined): Promise<void> {
  if (!url) return;
  if (UNSUPPORTED.some((re) => re.test(url))) {
    throw new ToolError(
      "UNSUPPORTED_PAGE",
      "Chrome does not let extensions act on this page (browser pages, extension pages, Chrome Web Store).",
    );
  }
  const { blocklist } = await getSettings();
  if (isBlocked(url, blocklist)) {
    throw new ToolError(
      "DOMAIN_BLOCKED",
      `${new URL(url).hostname} is on the user's blocklist. Do not try to use this site; ask the user instead.`,
    );
  }
}

/** Checks where a tab ended up after loading; a blocked destination sends the tab to about:blank. */
async function checkLanded(tab: chrome.tabs.Tab): Promise<void> {
  try {
    await checkUrl(tab.url ?? tab.pendingUrl);
  } catch (error) {
    if (tab.id !== undefined) await chrome.tabs.update(tab.id, { url: "about:blank" }).catch(() => {});
    throw error;
  }
}

async function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    throw new ToolError("TAB_NOT_FOUND", `Tab ${tabId} does not exist. Call list_tabs to see the open tabs.`);
  }
}

/** The requested tab or the active tab of the last focused window, after the URL checks. */
async function resolveTab(args: Args): Promise<chrome.tabs.Tab & { id: number }> {
  let tab: chrome.tabs.Tab | undefined;
  if (typeof args.tabId === "number") {
    tab = await getTab(args.tabId);
  } else {
    [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) [tab] = await chrome.tabs.query({ active: true });
  }
  if (!tab || tab.id === undefined) throw new ToolError("TAB_NOT_FOUND", "There is no active tab.");
  await checkUrl(tab.pendingUrl ?? tab.url);
  return tab as chrome.tabs.Tab & { id: number };
}

async function ensureReader(tabId: number): Promise<void> {
  const [probe] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => typeof globalThis.__aiba !== "undefined",
  });
  if (!probe?.result) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["reader.js"] });
  }
}

type ReaderResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

async function reader<K extends keyof ReaderApi>(
  tabId: number,
  name: K,
  ...args: Parameters<ReaderApi[K]>
): Promise<ReturnType<ReaderApi[K]>> {
  try {
    await ensureReader(tabId);
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (fn: string, fnArgs: unknown[]) => {
        try {
          const api = globalThis.__aiba as unknown as Record<string, (...a: unknown[]) => unknown>;
          return { ok: true, value: api[fn](...fnArgs) };
        } catch (e) {
          const err = e as { code?: string; detail?: string; message?: string };
          return { ok: false, code: err.code ?? "", message: err.detail ?? String(err.message ?? e) };
        }
      },
      args: [name, args as unknown[]],
    });
    const out = res?.result as ReaderResult<ReturnType<ReaderApi[K]>> | undefined;
    if (!out) throw new ToolError("UNSUPPORTED_PAGE", "Could not run in this page.");
    if (out.ok) return out.value;
    if (out.code === "ELEMENT_NOT_FOUND") throw new ToolError("ELEMENT_NOT_FOUND", out.message);
    throw new ToolError("UNSUPPORTED_PAGE", out.message);
  } catch (error) {
    throw cdp.mapChromeError(error);
  }
}

/** Resolves when the tab finishes loading after `start`. With `alreadyStarted`, also resolves if it already has. */
function waitForLoad(tabId: number, start: () => Promise<unknown>, alreadyStarted = false): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      fn();
    };
    const onUpdated = (id: number, info: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (id === tabId && info.status === "complete") finish(() => resolve(tab));
    };
    const onRemoved = (id: number) => {
      if (id === tabId) finish(() => reject(new ToolError("TAB_NOT_FOUND", `Tab ${tabId} was closed while loading.`)));
    };
    const timer = setTimeout(
      () => finish(() => reject(new ToolError("TIMEOUT", `The page did not finish loading in ${LOAD_TIMEOUT_MS / 1000} s.`))),
      LOAD_TIMEOUT_MS,
    );
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    start()
      .then(async () => {
        if (!alreadyStarted) return;
        const current = await chrome.tabs.get(tabId);
        if (current.status === "complete") finish(() => resolve(current));
      })
      .catch((error) => finish(() => reject(cdp.mapChromeError(error))));
  });
}

function requireIndex(args: Args, key = "index"): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ToolError("ELEMENT_NOT_FOUND", `"${key}" must be an element number from read_page.`);
  }
  return value;
}

async function clickIndex(tabId: number, index: number): Promise<void> {
  const { x, y } = await reader(tabId, "locate", index);
  await cdp.click(tabId, x, y);
}

async function typeInto(tabId: number, index: number, text: string, clear: boolean, submit: boolean): Promise<void> {
  if (clear) {
    await reader(tabId, "focusAndSelect", index);
    await cdp.pressKey(tabId, "Backspace");
  } else {
    await reader(tabId, "focusEnd", index);
  }
  if (text) await cdp.insertText(tabId, text);
  if (submit) await cdp.pressKey(tabId, "Enter");
}

function tabInfo(tab: chrome.tabs.Tab) {
  return { id: tab.id, title: tab.title ?? "", url: tab.url ?? tab.pendingUrl ?? "", active: tab.active, windowId: tab.windowId };
}

const tools: Record<ToolName, (args: Args) => Promise<ToolOutcome>> = {
  async read_page(args) {
    const tab = await resolveTab(args);
    const page: PageSnapshot = await reader(tab.id, "collect");
    return { data: { tabId: tab.id, ...page }, target: new URL(page.url || tab.url || "about:blank").hostname };
  },

  async click(args) {
    const tab = await resolveTab(args);
    const index = requireIndex(args);
    await clickIndex(tab.id, index);
    return { data: { clicked: index, tabId: tab.id }, target: `#${index}` };
  },

  async type(args) {
    const tab = await resolveTab(args);
    const index = requireIndex(args);
    const text = String(args.text ?? "");
    await typeInto(tab.id, index, text, args.clear !== false, args.submit === true);
    return { data: { typed: index, tabId: tab.id }, target: `#${index}` };
  },

  async fill_form(args) {
    const tab = await resolveTab(args);
    const fields = Array.isArray(args.fields) ? (args.fields as Array<{ index: number; value: unknown }>) : [];
    for (const field of fields) {
      const index = requireIndex(field as Args);
      const { kind, checked } = await reader(tab.id, "kindOf", index);
      if (kind === "select") {
        await reader(tab.id, "selectOption", index, String(field.value));
      } else if (kind === "toggle") {
        const wanted = field.value === true || field.value === "true";
        if (wanted !== checked) await clickIndex(tab.id, index);
      } else {
        await typeInto(tab.id, index, String(field.value ?? ""), true, false);
      }
    }
    return { data: { filled: fields.map((f) => f.index), tabId: tab.id }, target: `${fields.length} campos` };
  },

  async navigate(args) {
    const tab = await resolveTab(args);
    const url = typeof args.url === "string" ? args.url : undefined;
    const action = args.action as "back" | "forward" | "reload" | undefined;
    if (url) await checkUrl(url);
    const loaded = await waitForLoad(tab.id, () => {
      if (url) return chrome.tabs.update(tab.id, { url });
      if (action === "back") return chrome.tabs.goBack(tab.id);
      if (action === "forward") return chrome.tabs.goForward(tab.id);
      return chrome.tabs.reload(tab.id);
    });
    await checkLanded(loaded);
    return { data: tabInfo(loaded), target: url ?? action ?? "reload" };
  },

  async list_tabs() {
    const { blocklist } = await getSettings();
    const tabs = await chrome.tabs.query({});
    const data = tabs.map((t) => {
      const info = tabInfo(t);
      if (info.url && isBlocked(info.url, blocklist)) {
        return { ...info, title: "[bloqueado]", url: new URL(info.url).origin };
      }
      return info;
    });
    return { data, target: `${tabs.length} abas` };
  },

  async switch_tab(args) {
    if (typeof args.tabId !== "number") throw new ToolError("TAB_NOT_FOUND", "switch_tab needs a tabId from list_tabs.");
    const tab = await resolveTab(args);
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    return { data: tabInfo(await getTab(tab.id)), target: `aba ${tab.id}` };
  },

  async new_tab(args) {
    const url = typeof args.url === "string" ? args.url : undefined;
    await checkUrl(url);
    if (!url) {
      const tab = await chrome.tabs.create({ active: true });
      return { data: tabInfo(tab), target: "aba nova" };
    }
    const created = await chrome.tabs.create({ url, active: true });
    const tab = await waitForLoad(created.id!, async () => {}, true);
    await checkLanded(tab);
    return { data: tabInfo(tab), target: new URL(url).hostname };
  },

  async close_tab(args) {
    if (typeof args.tabId !== "number") throw new ToolError("TAB_NOT_FOUND", "close_tab needs a tabId from list_tabs.");
    const tab = await resolveTab(args);
    await chrome.tabs.remove(tab.id);
    return { data: { closed: tab.id }, target: `aba ${tab.id}` };
  },

  async screenshot(args) {
    const tab = await resolveTab(args);
    const data = await cdp.screenshot(tab.id);
    // The page may have navigated to a blocked site while the capture ran.
    await checkUrl((await getTab(tab.id)).url);
    return { data: { tabId: tab.id, data, mimeType: "image/png" }, target: `aba ${tab.id}` };
  },
};

export async function runTool(tool: ToolName, args: Args): Promise<ToolOutcome> {
  const fn = tools[tool];
  if (!fn) throw new ToolError("UNSUPPORTED_PAGE", `Unknown tool ${tool}.`);
  try {
    return await fn(args ?? {});
  } catch (error) {
    throw cdp.mapChromeError(error);
  }
}
