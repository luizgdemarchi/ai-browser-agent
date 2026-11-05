// Renders the extension icons (design.md of cycle 2026-11-05-visual-ui, § 3) to PNG.
// Run by hand after changing the drawing: npm run gen-icons. The PNGs are committed.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";

const OUT = "src/extension/icons";
const BG = "#1e2225";
const LINE = "#e6e8e3";
const AMBER = "#e8a317";

// 128-unit drawing, used for 32, 48 and 128 px.
const full = (active) => `
  <rect x="4" y="4" width="120" height="120" rx="26" fill="${BG}"/>
  <rect x="20" y="28" width="88" height="70" rx="9" fill="none" stroke="${LINE}" stroke-width="7"/>
  <line x1="20" y1="48" x2="108" y2="48" stroke="${LINE}" stroke-width="7"/>
  <circle cx="33" cy="38.5" r="3.5" fill="${LINE}"/>
  <circle cx="44" cy="38.5" r="3.5" fill="${LINE}"/>
  <circle cx="55" cy="38.5" r="3.5" fill="${LINE}"/>
  <path d="M68 60 L68 112 L81 99 L91 120 L102 115 L92 94 L110 94 Z" fill="${AMBER}" stroke="${BG}" stroke-width="6" stroke-linejoin="round"/>
  ${active ? `<circle cx="104" cy="24" r="22" fill="${AMBER}" stroke="${BG}" stroke-width="7"/>` : ""}`;

// 16-unit drawing for 16 px: no window dots, thicker strokes, bigger cursor.
const small = (active) => `
  <rect x="0.5" y="0.5" width="15" height="15" rx="3.5" fill="${BG}"/>
  <rect x="2.5" y="3.5" width="11" height="8.5" rx="1.5" fill="none" stroke="${LINE}" stroke-width="1.3"/>
  <line x1="2.5" y1="6" x2="13.5" y2="6" stroke="${LINE}" stroke-width="1.3"/>
  <path d="M7.5 7 L7.5 15 L9.4 13.2 L10.7 15.8 L12.2 15.1 L10.9 12.5 L13.6 12.5 Z" fill="${AMBER}" stroke="${BG}" stroke-width="0.9" stroke-linejoin="round"/>
  ${active ? `<circle cx="12.6" cy="3.4" r="3.2" fill="${AMBER}" stroke="${BG}" stroke-width="1"/>` : ""}`;

const ICONS = [
  ["icon-16.png", 16, small(false), 16],
  ["icon-32.png", 32, full(false), 128],
  ["icon-48.png", 48, full(false), 128],
  ["icon-128.png", 128, full(false), 128],
  ["icon-active-16.png", 16, small(true), 16],
  ["icon-active-32.png", 32, full(true), 128],
];

const browser = await puppeteer.launch();
try {
  const page = await browser.newPage();
  for (const [file, size, body, units] of ICONS) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${units} ${units}">${body}</svg>` +
        `</body></html>`,
    );
    const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    writeFileSync(join(OUT, file), png);
    console.log(`${file} ${size}x${size}`);
  }
} finally {
  await browser.close();
}
