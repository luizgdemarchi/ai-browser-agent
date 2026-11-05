import { getSession, getSettings, setSettings, timeAgo } from "./state.js";

const toggle = document.getElementById("toggle") as HTMLButtonElement;
const title = document.getElementById("toggle-title")!;
const action = document.getElementById("toggle-action")!;
const dot = document.getElementById("dot")!;
const connection = document.getElementById("connection")!;
const lastAction = document.getElementById("last-action")!;

async function render(): Promise<void> {
  const [settings, session] = await Promise.all([getSettings(), getSession()]);
  toggle.setAttribute("aria-pressed", String(settings.enabled));
  title.textContent = settings.enabled ? "IA com controle" : "IA sem controle";
  action.textContent = settings.enabled ? "Desligar" : "Ligar";

  dot.className = "dot";
  if (!settings.token) {
    dot.classList.add("erro");
    connection.textContent = "Sem token: cole o token em Opções e pareamento.";
  } else if (session.authFailed) {
    dot.classList.add("erro");
    connection.textContent = "Token recusado: copie o token de novo do arquivo indicado no README.";
  } else if (session.connected) {
    dot.classList.add("ok");
    connection.textContent = "Conectada ao servidor";
  } else {
    dot.classList.add("erro");
    connection.textContent =
      "Servidor não encontrado: rode o Claude Code ou o Codex com o MCP configurado.";
  }

  const last = session.lastAction;
  lastAction.textContent = last
    ? `Última ação: ${last.tool}${last.target ? " " + last.target : ""} · há ${timeAgo(last.at)}`
    : "Nenhuma ação ainda.";
}

toggle.addEventListener("click", async () => {
  const { enabled } = await getSettings();
  await setSettings({ enabled: !enabled });
  await chrome.runtime.sendMessage({ type: "settings-changed" }).catch(() => {});
});

chrome.storage.onChanged.addListener(() => void render());
setInterval(() => void render(), 5000);
void render();
