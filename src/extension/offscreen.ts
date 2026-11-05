// Holds the WebSocket to the local MCP server. The offscreen document is not suspended
// like the service worker, so the link survives; each command wakes the worker up.
import { CLOSE_UNAUTHORIZED, type CommandMessage } from "../shared/protocol.js";

const FIRST_RETRY_MS = 1000;
const RETRY_MS = 2000;

let socket: WebSocket | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;

function report(connected: boolean, authFailed = false): void {
  chrome.runtime.sendMessage({ type: "connection", connected, authFailed }).catch(() => {});
}

function scheduleRetry(delay: number): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void connect(), delay);
}

async function connect(): Promise<void> {
  const myGeneration = ++generation;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }

  let settings: { token: string; port: number };
  try {
    settings = (await chrome.runtime.sendMessage({ type: "get-settings" })) as { token: string; port: number };
  } catch {
    // The service worker may be restarting; try again soon.
    if (myGeneration === generation) scheduleRetry(FIRST_RETRY_MS);
    return;
  }
  if (myGeneration !== generation) return;
  const { token, port } = settings;
  if (!token) {
    report(false);
    scheduleRetry(RETRY_MS);
    return;
  }

  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  socket = ws;
  let welcomed = false;

  ws.onopen = () => ws.send(JSON.stringify({ type: "hello", role: "extension", token }));
  ws.onmessage = async (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.type === "welcome") {
      welcomed = true;
      report(true);
      return;
    }
    if (msg.type !== "command") return;
    const cmd = msg as CommandMessage;
    let result: unknown;
    try {
      result = await chrome.runtime.sendMessage({ type: "command", tool: cmd.tool, args: cmd.args });
    } catch (error) {
      result = { ok: false, error: { code: "NOT_CONNECTED", message: `Extension error: ${String(error)}` } };
    }
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "result", id: cmd.id, ...(result as object) }));
  };
  ws.onclose = (event) => {
    if (socket !== ws) return;
    socket = null;
    report(false, event.code === CLOSE_UNAUTHORIZED);
    // 1 s after losing a working link, then every 2 s.
    scheduleRetry(welcomed ? FIRST_RETRY_MS : RETRY_MS);
  };
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "settings-changed") void connect();
});

void connect();
