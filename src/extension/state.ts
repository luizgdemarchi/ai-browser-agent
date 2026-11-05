// Extension state shared by the service worker, popup and options page.

export const DEFAULT_PORT = 8765;

export interface Settings {
  enabled: boolean;
  token: string;
  port: number;
  blocklist: string[];
}

export interface LastAction {
  tool: string;
  target: string;
  at: number;
}

export interface SessionState {
  connected: boolean;
  /** Set when the server closed the connection for a bad token. */
  authFailed: boolean;
  lastAction: LastAction | null;
}

const DEFAULT_SETTINGS: Settings = { enabled: false, token: "", port: DEFAULT_PORT, blocklist: [] };
const DEFAULT_SESSION: SessionState = { connected: false, authFailed: false, lastAction: null };

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...stored } as Settings;
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(patch);
}

export async function getSession(): Promise<SessionState> {
  const stored = await chrome.storage.session.get(Object.keys(DEFAULT_SESSION));
  return { ...DEFAULT_SESSION, ...stored } as SessionState;
}

export async function setSession(patch: Partial<SessionState>): Promise<void> {
  await chrome.storage.session.set(patch);
}

/** Badge per spec R19: empty when off, "ON" amber when connected, "!" red when not. */
export async function updateBadge(): Promise<void> {
  const [{ enabled }, { connected }] = await Promise.all([getSettings(), getSession()]);
  if (!enabled) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }
  await chrome.action.setBadgeText({ text: connected ? "ON" : "!" });
  await chrome.action.setBadgeBackgroundColor({ color: connected ? "#E8A317" : "#C0392B" });
  await chrome.action.setBadgeTextColor({ color: connected ? "#1E2225" : "#FFFFFF" });
}

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.round(m / 60)} h`;
}
