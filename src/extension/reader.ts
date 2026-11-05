// Injected into the page's top frame (isolated world). Numbers the visible interactive
// elements, including those in same-origin iframes, and locates them for CDP input.
import { ToolError } from "../shared/protocol.js";

export interface PageElement {
  index: number;
  tag: string;
  role: string;
  label: string;
  value: string | boolean;
}

export interface PageSnapshot {
  url: string;
  title: string;
  text: string;
  elements: PageElement[];
}

const INTERACTIVE = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "[role=button]",
  "[role=link]",
  "[role=checkbox]",
  "[role=radio]",
  "[role=tab]",
  "[role=menuitem]",
  "[contenteditable=true]",
  "[contenteditable='']",
  "[onclick]",
].join(",");

const TEXT_LIMIT = 20_000;
const LABEL_LIMIT = 80;

let elements: Element[] = [];

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const view = el.ownerDocument.defaultView;
  if (!view) return false;
  if (view.getComputedStyle(el).visibility === "hidden") return false;
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (view.getComputedStyle(node).display === "none") return false;
  }
  return true;
}

function clip(text: string | null | undefined, limit = LABEL_LIMIT): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > limit ? t.slice(0, limit - 1) + "…" : t;
}

function labelOf(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria?.trim()) return clip(aria);
  const labels = (el as HTMLInputElement).labels;
  if (labels && labels.length > 0) {
    const text = clip(labels[0].textContent);
    if (text) return text;
  }
  const placeholder = el.getAttribute("placeholder");
  if (placeholder?.trim()) return clip(placeholder);
  if (el instanceof el.ownerDocument.defaultView!.HTMLSelectElement) {
    const selected = el.selectedOptions[0];
    if (selected) return clip(selected.textContent);
  }
  const inner = clip((el as HTMLElement).innerText ?? el.textContent);
  if (inner) return inner;
  return clip(el.getAttribute("title")) || clip(el.getAttribute("name"));
}

function valueOf(el: Element): string | boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "input") {
    const input = el as HTMLInputElement;
    if (input.type === "checkbox" || input.type === "radio") return input.checked;
    return input.value;
  }
  if (tag === "select") return (el as HTMLSelectElement).value;
  if (tag === "textarea") return (el as HTMLTextAreaElement).value;
  if (el.getAttribute("role") === "checkbox" || el.getAttribute("role") === "radio") {
    return el.getAttribute("aria-checked") === "true";
  }
  return "";
}

function roleOf(el: Element): string {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  if (tag === "a") return "link";
  if (tag === "input") return (el as HTMLInputElement).type || "text";
  if (tag === "select") return "combobox";
  if (tag === "textarea") return "textbox";
  return tag;
}

/** Documents of the page: the top document plus every same-origin iframe, depth-first. */
function documents(root: Document): Document[] {
  const docs = [root];
  for (const frame of root.querySelectorAll("iframe, frame")) {
    try {
      const inner = (frame as HTMLIFrameElement).contentDocument;
      if (inner) docs.push(...documents(inner));
    } catch {
      // Cross-origin frame: not readable in this version.
    }
  }
  return docs;
}

export function collect(root: Document = document): PageSnapshot {
  elements = [];
  for (const doc of documents(root)) {
    for (const el of doc.querySelectorAll(INTERACTIVE)) {
      if (isVisible(el)) elements.push(el);
    }
  }
  let text = (root.body?.innerText ?? root.body?.textContent ?? "").trim();
  if (text.length > TEXT_LIMIT) text = text.slice(0, TEXT_LIMIT) + "\n[texto cortado]";
  return {
    url: root.location?.href ?? "",
    title: root.title,
    text,
    elements: elements.map((el, i) => ({
      index: i + 1,
      tag: el.tagName.toLowerCase(),
      role: roleOf(el),
      label: labelOf(el),
      value: valueOf(el),
    })),
  };
}

function elementAt(index: number): Element {
  const el = elements[index - 1];
  if (!el || !el.isConnected) {
    throw new ToolError(
      "ELEMENT_NOT_FOUND",
      `Element ${index} no longer exists. Call read_page again to get fresh indexes.`,
    );
  }
  return el;
}

/** Scrolls the element into view and returns its center in top-frame viewport CSS pixels. */
export function locate(index: number): { x: number; y: number } {
  const el = elementAt(index);
  el.scrollIntoView({ block: "center", inline: "center" });
  const rect = el.getBoundingClientRect();
  let x = rect.left + rect.width / 2;
  let y = rect.top + rect.height / 2;
  for (let win: Window | null = el.ownerDocument.defaultView; win && win !== win.parent; win = win.parent) {
    const frame = win.frameElement;
    if (!frame) break;
    const frameRect = frame.getBoundingClientRect();
    x += frameRect.left + frame.clientLeft;
    y += frameRect.top + frame.clientTop;
  }
  return { x: Math.round(x), y: Math.round(y) };
}

/** Focuses the element and selects its content, so the next key press replaces it. */
export function focusAndSelect(index: number): void {
  const el = elementAt(index) as HTMLElement;
  el.scrollIntoView({ block: "center", inline: "center" });
  el.focus();
  if (el instanceof el.ownerDocument.defaultView!.HTMLInputElement || el.tagName === "TEXTAREA") {
    (el as HTMLInputElement).select();
  } else if (el.isContentEditable) {
    const range = el.ownerDocument.createRange();
    range.selectNodeContents(el);
    const sel = el.ownerDocument.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}

/** Focuses the element and puts the caret at the end, without selecting. */
export function focusEnd(index: number): void {
  const el = elementAt(index) as HTMLElement;
  el.scrollIntoView({ block: "center", inline: "center" });
  el.focus();
  if ("setSelectionRange" in el && typeof (el as HTMLInputElement).value === "string") {
    const len = (el as HTMLInputElement).value.length;
    try {
      (el as HTMLInputElement).setSelectionRange(len, len);
    } catch {
      // Input types like email do not support selection ranges.
    }
  }
}

/** Picks a <select> option by value or visible text and fires input + change. */
export function selectOption(index: number, choice: string): void {
  const el = elementAt(index);
  if (el.tagName !== "SELECT") {
    throw new ToolError("ELEMENT_NOT_FOUND", `Element ${index} is not a select.`);
  }
  const select = el as HTMLSelectElement;
  const wanted = choice.trim().toLowerCase();
  const option = [...select.options].find(
    (o) => o.value.toLowerCase() === wanted || (o.textContent ?? "").trim().toLowerCase() === wanted,
  );
  if (!option) {
    const names = [...select.options].map((o) => (o.textContent ?? "").trim()).join(", ");
    throw new ToolError("ELEMENT_NOT_FOUND", `Select ${index} has no option "${choice}". Options: ${names}.`);
  }
  select.value = option.value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Kind of the element, for fill_form to decide how to set it. */
export function kindOf(index: number): { kind: "text" | "select" | "toggle"; checked: boolean } {
  const el = elementAt(index);
  const tag = el.tagName.toLowerCase();
  if (tag === "select") return { kind: "select", checked: false };
  const type = (el as HTMLInputElement).type;
  if (tag === "input" && (type === "checkbox" || type === "radio")) {
    return { kind: "toggle", checked: (el as HTMLInputElement).checked };
  }
  const role = el.getAttribute("role");
  if (role === "checkbox" || role === "radio") {
    return { kind: "toggle", checked: el.getAttribute("aria-checked") === "true" };
  }
  return { kind: "text", checked: false };
}

export interface ReaderApi {
  collect: typeof collect;
  locate: typeof locate;
  focusAndSelect: typeof focusAndSelect;
  focusEnd: typeof focusEnd;
  selectOption: typeof selectOption;
  kindOf: typeof kindOf;
}

declare global {
  // eslint-disable-next-line no-var
  var __aiba: ReaderApi | undefined;
}

if (typeof chrome !== "undefined" && chrome.runtime?.id && typeof document !== "undefined") {
  globalThis.__aiba = { collect, locate, focusAndSelect, focusEnd, selectOption, kindOf };
}
