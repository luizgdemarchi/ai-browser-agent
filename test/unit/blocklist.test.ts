import { describe, expect, it } from "vitest";
import { isBlocked, normalizeDomain } from "../../src/shared/blocklist.js";

describe("isBlocked", () => {
  it("blocks the exact domain", () => {
    expect(isBlocked("https://bb.com.br/x", ["bb.com.br"])).toBe(true);
  });
  it("blocks subdomains", () => {
    expect(isBlocked("https://www.bb.com.br", ["bb.com.br"])).toBe(true);
  });
  it("does not block a domain that only ends with the same text", () => {
    expect(isBlocked("https://notbb.com.br", ["bb.com.br"])).toBe(false);
  });
  it("blocks IPs and ignores the port", () => {
    expect(isBlocked("http://127.0.0.1:5173/", ["127.0.0.1"])).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(isBlocked("https://BB.COM.BR", ["bb.com.br"])).toBe(true);
  });
  it("never blocks URLs without a host", () => {
    expect(isBlocked("about:blank", ["bb.com.br"])).toBe(false);
  });
  it("blocks nothing with an empty list", () => {
    expect(isBlocked("https://x.com", [])).toBe(false);
  });
  it("normalizes list items", () => {
    expect(normalizeDomain(" .BB.com.br ")).toBe("bb.com.br");
    expect(isBlocked("https://bb.com.br", [" .bb.com.br "])).toBe(true);
  });
  it("blocks hosts with a trailing dot", () => {
    expect(isBlocked("https://bank.com./x", ["bank.com"])).toBe(true);
    expect(isBlocked("https://www.bank.com../", ["bank.com"])).toBe(true);
  });
  it("blocks IPv4-mapped IPv6 addresses of a blocked IPv4", () => {
    expect(isBlocked("http://[::ffff:127.0.0.1]/", ["127.0.0.1"])).toBe(true);
    expect(isBlocked("http://[::ffff:7f00:1]:8080/", ["127.0.0.1"])).toBe(true);
  });
});
