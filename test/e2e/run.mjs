// End-to-end test: real Chrome (Chrome for Testing) + the built extension + real MCP servers
// over stdio. Uses port 18765 and a temporary AI_BROWSER_HOME so it never touches the
// user's real token or port.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createReadStream, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EXT_DIR = join(ROOT, "dist/extension");
const SERVER = join(ROOT, "dist/server/index.js");
const FIXTURES = join(ROOT, "test/e2e/fixtures");
const TMP = join(ROOT, ".e2e-tmp");
const HOME = join(TMP, "home");
const WS_PORT = 18765;
const HTTP_PORT = 18080;
const BASE = `http://127.0.0.1:${HTTP_PORT}`;
const EXT_ID = readFileSync(join(ROOT, "src/shared/extension-id.ts"), "utf8").match(/"([a-p]{32})"/)[1];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;

async function step(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL ${name}: ${error?.stack ?? error}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function text(result) {
  return result.content?.find((c) => c.type === "text")?.text ?? "";
}

async function call(client, name, args = {}) {
  return client.callTool({ name, arguments: args }, undefined, { timeout: 60_000 });
}

async function ok(client, name, args = {}) {
  const result = await call(client, name, args);
  if (result.isError) throw new Error(`${name} failed: ${text(result)}`);
  return result;
}

async function json(client, name, args = {}) {
  return JSON.parse(text(await ok(client, name, args)));
}

/** Retries until the tool succeeds or the time runs out. Returns the elapsed ms. */
async function succeedsWithin(client, name, ms) {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < ms) {
    const result = await call(client, name).catch((e) => ({ isError: true, content: [{ type: "text", text: String(e) }] }));
    if (!result.isError) return Date.now() - start;
    last = text(result);
    await sleep(500);
  }
  throw new Error(`${name} did not succeed in ${ms} ms. Last error: ${last}`);
}

async function startClient(label) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER],
    env: { ...process.env, AI_BROWSER_PORT: String(WS_PORT), AI_BROWSER_HOME: HOME },
    stderr: "pipe",
  });
  transport.stderr?.on("data", (d) => process.stderr.write(`[server ${label}] ${d}`));
  const client = new Client({ name: `e2e-${label}`, version: "0.0.0" });
  await client.connect(transport);
  return client;
}

function serveFixtures() {
  const types = { ".html": "text/html; charset=utf-8" };
  const server = createServer((req, res) => {
    // /redirect sends the browser to the same server under the name "localhost".
    if (req.url === "/redirect") {
      return res.writeHead(302, { location: `http://localhost:${HTTP_PORT}/other.html` }).end();
    }
    const file = join(FIXTURES, new URL(req.url, BASE).pathname.replace(/^\/+/, ""));
    if (!file.startsWith(FIXTURES)) return res.writeHead(403).end();
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    createReadStream(file)
      .on("error", () => res.end())
      .pipe(res);
  });
  return new Promise((r) => server.listen(HTTP_PORT, "127.0.0.1", () => r(server)));
}

function findIndex(page, label) {
  const el = page.elements.find((e) => e.label === label);
  assert(el, `element "${label}" not found in ${JSON.stringify(page.elements.map((e) => e.label))}`);
  return el.index;
}

async function main() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(HOME, { recursive: true });
  const http = await serveFixtures();
  const browser = await puppeteer.launch({
    headless: true,
    pipe: true,
    enableExtensions: [EXT_DIR],
    userDataDir: join(TMP, "profile"),
  });
  const clients = [];

  try {
    await browser.waitForTarget(
      (t) => t.type() === "service_worker" && t.url().startsWith(`chrome-extension://${EXT_ID}/`),
      { timeout: 15_000 },
    );


    const a = await startClient("A");
    clients.push(a);
    const token = readFileSync(join(HOME, "token"), "utf8").trim();

    const ui = await browser.newPage();
    await step("pair and turn on through the UI", async () => {
      await ui.goto(`chrome-extension://${EXT_ID}/options.html`);
      await ui.$eval("#port", (el) => (el.value = ""));
      await ui.type("#port", String(WS_PORT));
      await ui.type("#token", token);
      await ui.click("#save-token");
      await ui.goto(`chrome-extension://${EXT_ID}/popup.html`);
      await ui.waitForSelector("#toggle");
      if ((await ui.$eval("#toggle", (el) => el.getAttribute("aria-pressed"))) !== "true") await ui.click("#toggle");
      await ui.waitForFunction(() => document.querySelector("#toggle").getAttribute("aria-pressed") === "true");
      await ui.waitForFunction(() => document.querySelector("#connection").textContent === "Conectada ao servidor", {
        timeout: 10_000,
      });
    });

    await step("popup has no horizontal scroll", async () => {
      // Measure at the popup's own width (300 px), as Chrome sizes the real popup to it.
      const previous = ui.viewport();
      await ui.setViewport({ width: 300, height: 600 });
      try {
        const { scrollWidth, clientWidth } = await ui.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        assert(scrollWidth <= clientWidth, `popup scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`);
      } finally {
        if (previous) await ui.setViewport(previous);
      }
    });

    await step("options fit 320 px", async () => {
      const previous = ui.viewport();
      await ui.setViewport({ width: 320, height: 800 });
      try {
        await ui.goto(`chrome-extension://${EXT_ID}/options.html`);
        const width = await ui.evaluate(() => document.documentElement.scrollWidth);
        assert(width <= 320, `options scrollWidth at 320 px is ${width}`);
      } finally {
        if (previous) await ui.setViewport(previous);
      }
    });

    await step("token show/hide", async () => {
      await ui.goto(`chrome-extension://${EXT_ID}/options.html`);
      const type = () => ui.$eval("#token", (el) => el.type);
      assert((await type()) === "password", `token starts as ${await type()}`);
      await ui.click("#toggle-token");
      assert((await type()) === "text", `after Mostrar the token is ${await type()}`);
      await ui.click("#toggle-token");
      assert((await type()) === "password", `after Ocultar the token is ${await type()}`);
    });

    const form = await browser.newPage();
    await form.goto(`${BASE}/form.html`);
    await form.bringToFront();
    let formTab;

    await step("C3 read_page on the active tab", async () => {
      const page = await json(a, "read_page");
      assert(page.title === "Formulário de teste", `active tab is "${page.title}"`);
      formTab = page.tabId;
    });

    await step("C3 fill_form + click + trusted events", async () => {
      const page = await json(a, "read_page", { tabId: formTab });
      await ok(a, "fill_form", {
        tabId: formTab,
        fields: [
          { index: findIndex(page, "Nome"), value: "Ana" },
          { index: findIndex(page, "Email"), value: "ana@x.com" },
          { index: findIndex(page, "Plano"), value: "Pro" },
          { index: findIndex(page, "Aceito os termos"), value: true },
        ],
      });
      await ok(a, "click", { tabId: formTab, index: findIndex(page, "Enviar") });
      await sleep(300);
      const after = await json(a, "read_page", { tabId: formTab });
      const expected = "Enviado: Ana / ana@x.com / pro / true / trusted=true";
      assert(after.text.includes(expected), `page text does not contain "${expected}":\n${after.text}`);
    });

    await step("dialog opened by a click is dismissed and reported", async () => {
      const page = await json(a, "read_page", { tabId: formTab });
      const result = JSON.parse(text(await ok(a, "click", { tabId: formTab, index: findIndex(page, "Excluir") })));
      await sleep(300);
      const after = await json(a, "read_page", { tabId: formTab });
      const reported = result.dialogs?.[0];
      assert(after.text.includes("Excluir: nao"), `confirm was not dismissed:\n${after.text}`);
      assert(
        reported && reported.type === "confirm" && reported.handled === "dismissed" && reported.message === "Excluir tudo?",
        `dialog not reported in the click result: ${JSON.stringify(result)}`,
      );
    });

    let otherTab;
    await step("C3 new_tab, list_tabs, switch_tab", async () => {
      const created = await json(a, "new_tab", { url: `${BASE}/other.html` });
      otherTab = created.id;
      const tabs = await json(a, "list_tabs");
      assert(tabs.some((t) => t.id === formTab) && tabs.some((t) => t.id === otherTab), "both tabs should be listed");
      const switched = await json(a, "switch_tab", { tabId: formTab });
      assert(switched.active === true, "form tab should be active");
    });

    await step("C3 screenshot is a PNG", async () => {
      const result = await ok(a, "screenshot", { tabId: formTab });
      const image = result.content.find((c) => c.type === "image");
      assert(image, "no image content");
      const buf = Buffer.from(image.data, "base64");
      assert(buf.length > 0 && buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), "not a PNG");
    });

    await step("C3 close_tab", async () => {
      await ok(a, "close_tab", { tabId: otherTab });
      const tabs = await json(a, "list_tabs");
      assert(!tabs.some((t) => t.id === otherTab), "closed tab still listed");
    });

    const b = await startClient("B");
    clients.push(b);
    await step("C5 two servers at once", async () => {
      await ok(a, "list_tabs");
      await succeedsWithin(b, "list_tabs", 10_000);
    });

    await step("C6a service worker stopped", async () => {
      const session = await form.createCDPSession();
      await session.send("ServiceWorker.enable");
      await session.send("ServiceWorker.stopAllWorkers");
      const swAlive = () => browser.targets().some((t) => t.type() === "service_worker" && t.url().includes(EXT_ID));
      for (let i = 0; i < 30 && swAlive(); i++) await sleep(100);
      assert(!swAlive(), "the service worker did not stop");
      const ms = await succeedsWithin(a, "list_tabs", 10_000);
      console.log(`  list_tabs answered ${ms} ms after the stop`);
    });

    await step("C6b owner server goes away", async () => {
      await a.close();
      clients.splice(clients.indexOf(a), 1);
      const ms = await succeedsWithin(b, "list_tabs", 10_000);
      console.log(`  list_tabs answered ${ms} ms after the owner closed`);
    });

    await step("C4 redirect into a blocked domain", async () => {
      await ui.bringToFront();
      await ui.goto(`chrome-extension://${EXT_ID}/options.html`);
      await ui.type("#new-domain", "localhost");
      await ui.click("#add-domain");
      await ui.waitForFunction(() => document.querySelector("#blocklist").textContent.includes("localhost"));
      const result = await call(b, "navigate", { tabId: formTab, url: `${BASE}/redirect` });
      assert(result.isError && text(result).startsWith("[DOMAIN_BLOCKED]"), `got: ${text(result)}`);
      assert(!text(result).includes("Outra aba"), "the blocked page title leaked");
      const tabs = await json(b, "list_tabs");
      const tab = tabs.find((t) => t.id === formTab);
      assert(tab && !tab.url.includes("localhost"), `tab should have left the blocked page, is at ${tab?.url}`);
      await ok(b, "navigate", { tabId: formTab, url: `${BASE}/form.html` });
    });

    await step("C4 blocked domain", async () => {
      await ui.bringToFront();
      await ui.goto(`chrome-extension://${EXT_ID}/options.html`);
      await ui.type("#new-domain", "127.0.0.1:18080"); // the port must be ignored
      await ui.click("#add-domain");
      await ui.waitForFunction(() => document.querySelector("#blocklist").textContent.includes("127.0.0.1"));
      const result = await call(b, "read_page", { tabId: formTab });
      assert(result.isError && text(result).startsWith("[DOMAIN_BLOCKED]"), `got: ${text(result)}`);
    });

    await step("C4 extension off", async () => {
      await ui.bringToFront();
      await ui.goto(`chrome-extension://${EXT_ID}/popup.html`);
      await ui.waitForSelector("#toggle");
      if ((await ui.$eval("#toggle", (el) => el.getAttribute("aria-pressed"))) === "true") await ui.click("#toggle");
      await ui.waitForFunction(() => document.querySelector("#toggle").getAttribute("aria-pressed") === "false");
      const result = await call(b, "list_tabs");
      assert(result.isError && text(result).startsWith("[EXTENSION_OFF]"), `got: ${text(result)}`);
    });
  } finally {
    for (const c of clients) await c.close().catch(() => {});
    await browser.close().catch(() => {});
    await new Promise((r) => http.close(r));
    rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }

  console.log(failed ? `${failed} step(s) failed` : "all e2e steps passed");
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.log(`FAIL setup: ${error?.stack ?? error}`);
  process.exit(1);
});
