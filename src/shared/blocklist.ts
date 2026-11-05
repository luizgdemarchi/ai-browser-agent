export function normalizeDomain(item: string): string {
  return item.trim().toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "");
}

/** Canonical host: lowercase, no trailing dots, IPv4-mapped IPv6 turned into IPv4. */
export function canonicalHost(hostname: string): string {
  let host = hostname.toLowerCase().replace(/\.+$/, "");
  const mapped = host.match(/^\[::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})\]$/);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    host = [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
  }
  return host;
}

/** True when the URL's host is a blocklist item or a subdomain of one. Port and scheme are ignored. */
export function isBlocked(url: string, list: readonly string[]): boolean {
  let host: string;
  try {
    host = canonicalHost(new URL(url).hostname);
  } catch {
    return false;
  }
  if (!host) return false;
  return list.some((raw) => {
    const item = normalizeDomain(raw);
    return item !== "" && (host === item || host.endsWith("." + item));
  });
}
