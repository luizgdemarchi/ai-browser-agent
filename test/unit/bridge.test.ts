import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createBridge, type Bridge } from "../../src/server/bridge.js";
import { ToolError, type CommandMessage } from "../../src/shared/protocol.js";

const EXT_ID = "abcdefghijklmnopabcdefghijklmnop";
const TOKEN = "a".repeat(64);
const EXT_ORIGIN = `chrome-extension://${EXT_ID}`;

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(50);
  }
  throw new Error("waitFor timed out");
}

/** Opens a socket and resolves with how it ended: an HTTP status, a close code, or "open". */
function probe(port: number, opts: { origin?: string; hello?: object | null }): Promise<string> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, opts.origin ? { origin: opts.origin } : {});
    ws.on("unexpected-response", (_req, res) => resolve(`http ${res.statusCode}`));
    ws.on("error", () => {});
    ws.on("open", () => {
      if (opts.hello !== null) ws.send(JSON.stringify(opts.hello));
    });
    ws.on("message", (raw) => {
      if (JSON.parse(String(raw)).type === "welcome") {
        resolve("welcome");
        ws.close();
      }
    });
    ws.on("close", (code) => resolve(`close ${code}`));
  });
}

interface FakeExtension {
  stop(): void;
  connected(): boolean;
}

/** A fake extension that answers every command with { echo: tool } and reconnects every 500 ms. */
function fakeExtension(port: number, opts: { silent?: boolean } = {}): FakeExtension {
  let ws: WebSocket | null = null;
  let ready = false;
  let stopped = false;
  const connect = () => {
    if (stopped) return;
    ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin: EXT_ORIGIN });
    ws.on("error", () => {});
    ws.on("open", () => ws!.send(JSON.stringify({ type: "hello", role: "extension", token: TOKEN })));
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === "welcome") ready = true;
      if (msg.type === "command" && !opts.silent) {
        const cmd = msg as CommandMessage;
        ws!.send(JSON.stringify({ type: "result", id: cmd.id, ok: true, data: { echo: cmd.tool } }));
      }
    });
    ws.on("close", () => {
      ready = false;
      setTimeout(connect, 500);
    });
  };
  connect();
  return {
    stop() {
      stopped = true;
      ws?.close();
    },
    connected: () => ready,
  };
}

describe("bridge", () => {
  const cleanups: Array<() => unknown> = [];
  afterEach(async () => {
    for (const fn of cleanups.splice(0).reverse()) await fn();
  });

  async function owner(port: number, extra: Partial<Parameters<typeof createBridge>[0]> = {}): Promise<Bridge> {
    const b = createBridge({ port, token: TOKEN, extensionId: EXT_ID, ...extra });
    cleanups.push(() => b.close());
    await b.start();
    return b;
  }
  function ext(port: number, opts?: { silent?: boolean }): FakeExtension {
    const e = fakeExtension(port, opts);
    cleanups.push(() => e.stop());
    return e;
  }

  it("a. rejects a foreign Origin with 403", async () => {
    const port = await freePort();
    await owner(port);
    expect(await probe(port, { origin: "https://evil.com", hello: { type: "hello", role: "extension", token: TOKEN } })).toBe(
      "http 403",
    );
  });

  it("b. closes an extension with a wrong token with 4401", async () => {
    const port = await freePort();
    await owner(port);
    expect(await probe(port, { origin: EXT_ORIGIN, hello: { type: "hello", role: "extension", token: "b".repeat(64) } })).toBe(
      "close 4401",
    );
  });

  it("c. closes the extension Origin claiming role relay with 4401", async () => {
    const port = await freePort();
    await owner(port);
    expect(await probe(port, { origin: EXT_ORIGIN, hello: { type: "hello", role: "relay", token: TOKEN } })).toBe("close 4401");
  });

  it("d. closes a connection without Origin claiming role extension with 4401", async () => {
    const port = await freePort();
    await owner(port);
    expect(await probe(port, { hello: { type: "hello", role: "extension", token: TOKEN } })).toBe("close 4401");
  });

  it("e. closes a connection that never says hello with 4401", async () => {
    const port = await freePort();
    await owner(port, { helloTimeoutMs: 200 });
    expect(await probe(port, { origin: EXT_ORIGIN, hello: null })).toBe("close 4401");
  });

  it("f. owner forwards commands to the extension", async () => {
    const port = await freePort();
    const b = await owner(port);
    expect(b.role).toBe("owner");
    const e = ext(port);
    await waitFor(() => e.connected());
    expect(await b.send("list_tabs", {})).toEqual({ echo: "list_tabs" });
  });

  it("g. owner without extension rejects with NOT_CONNECTED", async () => {
    const port = await freePort();
    const b = await owner(port);
    const err = (await b.send("list_tabs", {}).catch((e) => e)) as ToolError;
    expect(err).toBeInstanceOf(ToolError);
    expect(err.code).toBe("NOT_CONNECTED");
  });

  it("h. a second bridge on the same port becomes a relay through the owner", async () => {
    const port = await freePort();
    await owner(port);
    const e = ext(port);
    await waitFor(() => e.connected());
    const relay = await owner(port);
    expect(relay.role).toBe("relay");
    expect(await relay.send("read_page", {})).toEqual({ echo: "read_page" });
  });

  it("i. the relay takes over when the owner goes away", async () => {
    const port = await freePort();
    const first = await owner(port);
    const e = ext(port);
    await waitFor(() => e.connected());
    const second = await owner(port);
    expect(second.role).toBe("relay");
    await first.close();
    await waitFor(() => second.role === "owner", 3000);
    await waitFor(() => e.connected(), 3000);
    expect(await second.send("list_tabs", {})).toEqual({ echo: "list_tabs" });
  });

  it("j. a command the extension never answers rejects with TIMEOUT", async () => {
    const port = await freePort();
    const b = await owner(port, { commandTimeoutMs: 300 });
    const e = ext(port, { silent: true });
    await waitFor(() => e.connected());
    const err = (await b.send("list_tabs", {}).catch((x) => x)) as ToolError;
    expect(err).toBeInstanceOf(ToolError);
    expect(err.code).toBe("TIMEOUT");
  });
});
