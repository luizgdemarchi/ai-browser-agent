// WebSocket bridge between MCP servers and the extension.
// The first server to bind the port is the owner: the extension connects to it, and any
// other server connects to it as a relay and forwards its commands. When the owner goes
// away, a relay takes the port over.
import { randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import {
  CLOSE_UNAUTHORIZED,
  isErrorCode,
  ToolError,
  type CommandMessage,
  type ResultMessage,
  type Role,
  type ToolName,
} from "../shared/protocol.js";

export interface BridgeOptions {
  port: number;
  token: string;
  extensionId: string;
  helloTimeoutMs?: number;
  commandTimeoutMs?: number;
  log?: (message: string) => void;
}

export interface Bridge {
  readonly role: "owner" | "relay" | "idle";
  start(): Promise<void>;
  send(tool: ToolName, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

interface Pending {
  resolve(data: unknown): void;
  reject(error: ToolError): void;
  timer: NodeJS.Timeout;
}

/** Where the owner must send the result of a command it forwarded to the extension. */
interface Forwarded {
  relay: WebSocket;
  relayId: string;
  timer: NodeJS.Timeout;
}

const RELAY_RETRY_MS = 300;

function tokensMatch(given: unknown, expected: string): boolean {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parse(raw: WebSocket.RawData): Record<string, unknown> | null {
  try {
    const value = JSON.parse(String(raw));
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function toError(result: Extract<ResultMessage, { ok: false }>): ToolError {
  const code = isErrorCode(result.error?.code) ? result.error.code : "TIMEOUT";
  return new ToolError(code, String(result.error?.message ?? "Unknown error."));
}

export function createBridge(options: BridgeOptions): Bridge {
  const { port, token, extensionId } = options;
  const helloTimeoutMs = options.helloTimeoutMs ?? 3000;
  const commandTimeoutMs = options.commandTimeoutMs ?? 35_000;
  const log = options.log ?? ((m: string) => process.stderr.write(`[ai-browser] ${m}\n`));
  const extensionOrigin = `chrome-extension://${extensionId}`;

  let role: Bridge["role"] = "idle";
  let closed = false;

  // Owner state.
  let http: Server | null = null;
  let wss: WebSocketServer | null = null;
  let extension: WebSocket | null = null;
  const forwarded = new Map<string, Forwarded>();

  // Relay state.
  let upstream: WebSocket | null = null;
  let upstreamReady = false;
  let connecting: Promise<void> | null = null;

  // Commands sent by this server, in either role.
  const pending = new Map<string, Pending>();

  function failAllPending(error: ToolError): void {
    for (const [id, p] of pending) {
      clearTimeout(p.timer);
      p.reject(error);
      pending.delete(id);
    }
  }

  function settle(id: string, result: ResultMessage): void {
    const p = pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(id);
    if (result.ok) p.resolve(result.data);
    else p.reject(toError(result));
  }

  // ---------- Owner ----------

  function expectedRole(req: IncomingMessage): Role | null {
    const origin = req.headers.origin;
    if (origin === undefined) return "relay";
    if (origin === extensionOrigin) return "extension";
    return null;
  }

  function dropExtension(socket: WebSocket): void {
    if (extension !== socket) return;
    extension = null;
    const error = new ToolError("NOT_CONNECTED", "The browser extension disconnected while running the command.");
    failAllPending(error);
    for (const [id, f] of forwarded) {
      clearTimeout(f.timer);
      sendResult(f.relay, f.relayId, error);
      forwarded.delete(id);
    }
  }

  function sendResult(socket: WebSocket, id: string, outcome: ToolError | { data: unknown }): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    const message: ResultMessage =
      outcome instanceof ToolError
        ? { type: "result", id, ok: false, error: { code: outcome.code, message: outcome.detail } }
        : { type: "result", id, ok: true, data: outcome.data };
    socket.send(JSON.stringify(message));
  }

  function onExtensionMessage(msg: Record<string, unknown>): void {
    if (msg.type !== "result" || typeof msg.id !== "string") return;
    const result = msg as unknown as ResultMessage;
    const f = forwarded.get(result.id);
    if (f) {
      clearTimeout(f.timer);
      forwarded.delete(result.id);
      if (f.relay.readyState === WebSocket.OPEN) {
        f.relay.send(JSON.stringify({ ...result, id: f.relayId }));
      }
      return;
    }
    settle(result.id, result);
  }

  function onRelayMessage(relay: WebSocket, msg: Record<string, unknown>): void {
    if (msg.type !== "command" || typeof msg.id !== "string") return;
    const cmd = msg as unknown as CommandMessage;
    if (!extension) {
      sendResult(relay, cmd.id, notConnected());
      return;
    }
    const id = randomUUID();
    const timer = setTimeout(() => {
      forwarded.delete(id);
      sendResult(relay, cmd.id, timeoutError(cmd.tool));
    }, commandTimeoutMs);
    forwarded.set(id, { relay, relayId: cmd.id, timer });
    extension.send(JSON.stringify({ type: "command", id, tool: cmd.tool, args: cmd.args ?? {} }));
  }

  function onConnection(socket: WebSocket, req: IncomingMessage): void {
    const expected = expectedRole(req);
    let authed: Role | null = null;
    const helloTimer = setTimeout(() => socket.close(CLOSE_UNAUTHORIZED, "hello timeout"), helloTimeoutMs);

    socket.on("message", (raw) => {
      const msg = parse(raw);
      if (!msg) return;
      if (!authed) {
        clearTimeout(helloTimer);
        if (msg.type !== "hello" || msg.role !== expected || !tokensMatch(msg.token, token)) {
          socket.close(CLOSE_UNAUTHORIZED, "unauthorized");
          return;
        }
        authed = expected;
        socket.send(JSON.stringify({ type: "welcome" }));
        if (authed === "extension") {
          const previous = extension;
          extension = socket;
          if (previous) {
            dropExtensionSilently(previous);
          }
          log("extension connected");
        }
        return;
      }
      if (authed === "extension") onExtensionMessage(msg);
      else onRelayMessage(socket, msg);
    });

    socket.on("close", () => {
      clearTimeout(helloTimer);
      if (authed === "extension") {
        dropExtension(socket);
        if (!extension) log("extension disconnected");
      }
      if (authed === "relay") {
        for (const [id, f] of forwarded) {
          if (f.relay === socket) {
            clearTimeout(f.timer);
            forwarded.delete(id);
          }
        }
      }
    });
    socket.on("error", () => {});
  }

  /** A newer extension connection replaces an older one; in-flight commands stay on the old one. */
  function dropExtensionSilently(socket: WebSocket): void {
    socket.removeAllListeners("close");
    socket.on("close", () => {});
    socket.close(1000, "replaced");
  }

  function tryOwn(): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer((_req, res) => {
        res.writeHead(426).end();
      });
      const onError = (err: NodeJS.ErrnoException) => {
        server.close();
        if (err.code !== "EADDRINUSE") log(`could not listen on 127.0.0.1:${port}: ${err.message}`);
        resolve(false);
      };
      server.once("error", onError);
      server.listen(port, "127.0.0.1", () => {
        server.off("error", onError);
        if (closed) {
          server.close();
          resolve(false);
          return;
        }
        http = server;
        wss = new WebSocketServer({
          server,
          maxPayload: 64 * 1024 * 1024,
          verifyClient: (info, cb) => {
            if (expectedRole(info.req)) cb(true);
            else cb(false, 403, "Forbidden");
          },
        });
        wss.on("connection", onConnection);
        role = "owner";
        log(`listening on 127.0.0.1:${port} (owner)`);
        resolve(true);
      });
    });
  }

  // ---------- Relay ----------

  function connectRelay(): Promise<boolean> {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`, { maxPayload: 64 * 1024 * 1024 });
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      ws.on("open", () => ws.send(JSON.stringify({ type: "hello", role: "relay", token })));
      ws.on("message", (raw) => {
        const msg = parse(raw);
        if (!msg) return;
        if (msg.type === "welcome") {
          upstream = ws;
          upstreamReady = true;
          role = "relay";
          log(`connected to the server on 127.0.0.1:${port} (relay)`);
          finish(true);
          return;
        }
        if (msg.type === "result" && typeof msg.id === "string") settle(msg.id, msg as unknown as ResultMessage);
      });
      ws.on("close", (code) => {
        if (code === CLOSE_UNAUTHORIZED) log("the server on this port refused our token");
        if (upstream === ws) {
          upstream = null;
          upstreamReady = false;
          role = "idle";
          failAllPending(new ToolError("NOT_CONNECTED", "Lost the connection to the server that owns the browser link. Try again."));
          if (!closed) void ensureConnected();
        }
        finish(false);
      });
      ws.on("error", () => {});
    });
  }

  /** Becomes owner if the port is free, else relay. Retries until one works or the bridge closes. */
  function ensureConnected(): Promise<void> {
    if (role === "owner" || (role === "relay" && upstreamReady)) return Promise.resolve();
    if (connecting) return connecting;
    connecting = (async () => {
      while (!closed) {
        if (await tryOwn()) break;
        if (await connectRelay()) break;
        await new Promise((r) => setTimeout(r, RELAY_RETRY_MS));
      }
    })().finally(() => {
      connecting = null;
    });
    return connecting;
  }

  // ---------- Commands ----------

  function notConnected(): ToolError {
    return new ToolError(
      "NOT_CONNECTED",
      "The browser extension is not connected. Open Chrome, check that the AI Browser Agent extension is installed and paired (see README).",
    );
  }

  function timeoutError(tool: string): ToolError {
    return new ToolError("TIMEOUT", `The browser did not answer ${tool} in ${Math.round(commandTimeoutMs / 1000)} s.`);
  }

  async function send(tool: ToolName, args: Record<string, unknown>): Promise<unknown> {
    await ensureConnected();
    const target = role === "owner" ? extension : upstreamReady ? upstream : null;
    if (!target) throw notConnected();
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(timeoutError(tool));
      }, commandTimeoutMs + (role === "relay" ? 1000 : 0));
      pending.set(id, { resolve, reject, timer });
      target.send(JSON.stringify({ type: "command", id, tool, args } satisfies CommandMessage));
    });
  }

  return {
    get role() {
      return role;
    },
    start: ensureConnected,
    send,
    async close() {
      closed = true;
      failAllPending(new ToolError("NOT_CONNECTED", "The MCP server is shutting down."));
      upstream?.close();
      upstream = null;
      upstreamReady = false;
      if (wss) {
        for (const client of wss.clients) client.terminate();
        await new Promise<void>((r) => wss!.close(() => r()));
      }
      if (http) await new Promise<void>((r) => http!.close(() => r()));
      wss = null;
      http = null;
      extension = null;
      role = "idle";
    },
  };
}
