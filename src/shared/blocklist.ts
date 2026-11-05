export function normalizeDomain(item: string): string {
  return item.trim().toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "");
}

/** True when the URL's host is a blocklist item or a subdomain of one. Port and scheme are ignored. */
export function isBlocked(url: string, list: readonly string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host) return false;
  return list.some((raw) => {
    const item = normalizeDomain(raw);
    return item !== "" && (host === item || host.endsWith("." + item));
  });
}
