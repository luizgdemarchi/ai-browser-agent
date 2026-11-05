import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../../src/shared/url.js";

describe("normalizeUrl", () => {
  it("adds https:// when the scheme is missing", () => {
    expect(normalizeUrl("google.com")).toBe("https://google.com/");
    expect(normalizeUrl("localhost:3000/x")).toBe("https://localhost:3000/x");
  });
  it("keeps URLs that have a scheme", () => {
    expect(normalizeUrl("http://127.0.0.1:8080/a")).toBe("http://127.0.0.1:8080/a");
    expect(normalizeUrl("about:blank")).toBe("about:blank");
  });
  it("returns null for text that is not a URL", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
});
