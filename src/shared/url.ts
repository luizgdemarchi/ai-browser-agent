/** URL the browser should open: adds https:// when the scheme is missing; null if it is not a URL. */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[^/:]+:\d+(\/|$)/.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (/^https?:$/.test(url.protocol) && !url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}
