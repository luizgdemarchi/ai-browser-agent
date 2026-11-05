import { normalizeDomain } from "../shared/blocklist.js";
import { getSession, getSettings, setSettings } from "./state.js";

const pairForm = document.getElementById("pair-form") as HTMLFormElement;
const token = document.getElementById("token") as HTMLInputElement;
const port = document.getElementById("port") as HTMLInputElement;
const pairDot = document.getElementById("pair-dot")!;
const pairStatus = document.getElementById("pair-status")!;
const list = document.getElementById("blocklist")!;
const empty = document.getElementById("empty")!;
const addForm = document.getElementById("add-form") as HTMLFormElement;
const newDomain = document.getElementById("new-domain") as HTMLInputElement;
const addError = document.getElementById("add-error")!;
const toggleToken = document.getElementById("toggle-token") as HTMLButtonElement;

document.getElementById("version")!.textContent = "v" + chrome.runtime.getManifest().version;

toggleToken.addEventListener("click", () => {
  const show = token.type === "password";
  token.type = show ? "text" : "password";
  toggleToken.textContent = show ? "Ocultar" : "Mostrar";
  toggleToken.setAttribute("aria-pressed", String(show));
});

async function notify(): Promise<void> {
  await chrome.runtime.sendMessage({ type: "settings-changed" }).catch(() => {});
}

async function renderStatus(): Promise<void> {
  const [settings, session] = await Promise.all([getSettings(), getSession()]);
  pairDot.className = "dot";
  if (!settings.token) {
    pairStatus.textContent = "Sem token: cole o token acima e clique em Salvar token.";
  } else if (session.authFailed) {
    pairDot.classList.add("erro");
    pairStatus.textContent = "Token recusado pelo servidor. Copie de novo o token de ~/.ai-browser-agent/token.";
  } else if (session.connected) {
    pairDot.classList.add("ok");
    pairStatus.textContent = "Pareada e conectada.";
  } else {
    pairDot.classList.add("erro");
    pairStatus.textContent = "Servidor não encontrado nesta porta. Rode o Claude Code ou o Codex.";
  }
}

function renderList(blocklist: string[]): void {
  list.replaceChildren(
    ...blocklist.map((domain) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "mono";
      name.textContent = domain;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remover";
      remove.setAttribute("aria-label", `Remover ${domain}`);
      remove.addEventListener("click", async () => {
        const current = (await getSettings()).blocklist.filter((d) => d !== domain);
        await setSettings({ blocklist: current });
        renderList(current);
      });
      li.append(name, remove);
      return li;
    }),
  );
  empty.hidden = blocklist.length > 0;
  list.hidden = blocklist.length === 0;
}

pairForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const portNumber = Number(port.value);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    pairStatus.textContent = "Porta inválida: use um número entre 1 e 65535.";
    pairDot.className = "dot erro";
    return;
  }
  await setSettings({ token: token.value.trim(), port: portNumber });
  await notify();
  pairDot.className = "dot";
  pairStatus.textContent = "Salvo. Conectando…";
  // The connection state may not change (same result as before), so storage events alone
  // would leave this message up; poll it for a while instead.
  let checks = 0;
  const poll = setInterval(() => {
    if (++checks > 10) clearInterval(poll);
    void renderStatus();
  }, 1000);
});

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const domain = normalizeDomain(newDomain.value);
  if (!domain) {
    addError.textContent = newDomain.value.trim()
      ? `"${newDomain.value.trim()}" não é um domínio. Use algo como bb.com.br.`
      : "Digite um domínio, por exemplo bb.com.br.";
    return;
  }
  addError.textContent = "";
  const current = (await getSettings()).blocklist;
  if (!current.includes(domain)) {
    current.push(domain);
    await setSettings({ blocklist: current });
  }
  newDomain.value = "";
  renderList(current);
});

async function init(): Promise<void> {
  const settings = await getSettings();
  token.value = settings.token;
  port.value = String(settings.port);
  renderList(settings.blocklist);
  await renderStatus();
}

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "session") void renderStatus();
});
void init();
