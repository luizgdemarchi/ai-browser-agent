// What the toolbar button shows for each extension state (spec 2026-11-05-visual-ui, R13/R14).
// Pure, so it runs in unit tests without the chrome API.

export interface IconState {
  variant: "padrao" | "ativo";
  badgeText: string;
  /** null when the badge is empty, so its colors do not matter. */
  badgeColor: string | null;
  badgeTextColor: string | null;
  title: string;
}

const NAME = "AI Browser Agent";

export function iconState(enabled: boolean, connected: boolean): IconState {
  if (!enabled) {
    return { variant: "padrao", badgeText: "", badgeColor: null, badgeTextColor: null, title: `${NAME} — desligada` };
  }
  if (connected) {
    return { variant: "ativo", badgeText: "", badgeColor: null, badgeTextColor: null, title: `${NAME} — IA com controle` };
  }
  return {
    variant: "padrao",
    badgeText: "!",
    badgeColor: "#C0392B",
    badgeTextColor: "#FFFFFF",
    title: `${NAME} — sem conexão com o servidor`,
  };
}
