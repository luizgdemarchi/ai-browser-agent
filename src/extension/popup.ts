import { getSession, getSettings, setSettings, timeAgo } from "./state.js";

const toggle = document.getElementById("toggle") as HTMLButtonElement;
const title = document.getElementById("toggle-title")!;
const desc = document.getElementById("toggle-desc")!;
const dot = document.getElementById("dot")!;
const connection = document.getElementById("connection")!;
const lastEmpty = document.getElementById("last-action-empty")!;
const lastBody = document.getElementById("last-action-body")!;
const lastTool = document.getElementById("last-action-tool")!;
const lastTarget = document.getElementById("last-action-target")!;
const lastTime = document.getElementById("last-action-time")!;

document.getElementById("version")!.textContent = "v" + chrome.runtime.getManifest().version;

async function render(): Promise<void> {
  const [settings, session] = await Promise.all([getSettings(), getSession()]);
  toggle.setAttribute("aria-pressed", String(settings.enabled));
  title.textContent = settings.enabled ? "IA com controle" : "IA sem controle";
  desc.textContent = settings.enabled
    ? "A IA pode usar este Chrome. Clique para desligar."
    : "Clique para a IA poder usar este Chrome.";

  dot.className = "dot";
  if (!settings.token) {
    dot.classList.add("erro");
    connection.textContent = "Sem token: cole o token em Opções e pareamento.";
  } else if (session.authFailed) {
    dot.classList.add("erro");
    connection.textContent = "Token recusado: copie de novo o token de ~/.ai-browser-agent/token e salve em Opções.";
  } else if (session.connected) {
    dot.classList.add("ok");
    connection.textContent = "Conectada ao servidor";
  } else {
    dot.classList.add("erro");
    connection.textContent =
      "Servidor não encontrado: rode o Claude Code ou o Codex com o MCP configurado.";
  }

  const last = session.lastAction;
  lastEmpty.hidden = !!last;
  lastBody.hidden = !last;
  if (last) {
    lastTool.textContent = last.tool;
    lastTarget.textContent = last.target;
    lastTime.textContent = `há ${timeAgo(last.at)}`;
  }
}

toggle.addEventListener("click", async () => {
  const { enabled } = await getSettings();
  if (!enabled) {
    // The "on air" pulse of design.md § 6, only when turning on.
    toggle.classList.remove("pulse");
    void toggle.offsetWidth;
    toggle.classList.add("pulse");
  }
  await setSettings({ enabled: !enabled });
  await chrome.runtime.sendMessage({ type: "settings-changed" }).catch(() => {});
});

toggle.addEventListener("animationend", () => toggle.classList.remove("pulse"));
chrome.storage.onChanged.addListener(() => void render());
setInterval(() => void render(), 5000);
void render();
