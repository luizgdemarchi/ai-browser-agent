// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { collect, locate, selectOption } from "../../src/extension/reader.js";
import { ToolError } from "../../src/shared/protocol.js";

function fakeRect(el: Element, x: number, y: number, w = 100, h = 20) {
  (el as HTMLElement).getBoundingClientRect = () =>
    ({ x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON() {} }) as DOMRect;
}

describe("reader", () => {
  beforeEach(() => {
    document.title = "Teste";
    document.body.innerHTML = `
      <button id="b">Entrar</button>
      <input id="e" placeholder="Email">
      <input type="hidden" name="secret">
      <div style="display:none"><a href="#" id="hid">Oculto</a></div>
      <select id="s"><option value="a">Opção A</option><option value="b">Opção B</option></select>`;
    fakeRect(document.getElementById("b")!, 10, 10);
    fakeRect(document.getElementById("e")!, 10, 50, 200, 30);
    fakeRect(document.getElementById("hid")!, 10, 90);
    fakeRect(document.getElementById("s")!, 10, 130);
    for (const el of document.querySelectorAll("*")) (el as HTMLElement).scrollIntoView = () => {};
  });

  it("lists only visible interactive elements, numbered from 1", () => {
    const page = collect(document);
    expect(page.title).toBe("Teste");
    expect(page.elements.map((e) => [e.index, e.tag, e.label])).toEqual([
      [1, "button", "Entrar"],
      [2, "input", "Email"],
      [3, "select", "Opção A"],
    ]);
  });

  it("locates an element by its index at the center of its box", () => {
    collect(document);
    expect(locate(2)).toEqual({ x: 110, y: 65 });
  });

  it("throws ELEMENT_NOT_FOUND for an unknown index", () => {
    collect(document);
    try {
      locate(99);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ToolError);
      expect((e as ToolError).code).toBe("ELEMENT_NOT_FOUND");
    }
  });

  it("selects an option by text and fires change", () => {
    collect(document);
    const s = document.getElementById("s") as HTMLSelectElement;
    let changed = 0;
    s.addEventListener("change", () => changed++);
    selectOption(3, "Opção B");
    expect(s.value).toBe("b");
    expect(changed).toBe(1);
  });
});
