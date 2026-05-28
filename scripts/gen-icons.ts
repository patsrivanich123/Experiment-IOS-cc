/**
 * Generate PNG app icons from public/icons/icon.svg at the sizes iOS,
 * Android and Vercel need. One-shot — re-run only when icon.svg changes.
 *
 *   npm run gen:icons
 *
 * Uses the Playwright chromium already installed in the dev environment.
 */

import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SVG = readFileSync(join("public", "icons", "icon.svg"), "utf8");

// Sizes:
//   180 — apple-touch-icon (iOS home screen)
//   192, 512 — Android / PWA manifest
const SIZES = [180, 192, 512] as const;

async function main(): Promise<void> {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    headless: true,
  });
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  for (const size of SIZES) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:#0b0d12">
         <div style="width:${size}px;height:${size}px">${SVG.replace(
           /width="512"|height="512"/g,
           "",
         ).replace("<svg ", `<svg width="${size}" height="${size}" `)}</div>
       </body></html>`,
      { waitUntil: "domcontentloaded" },
    );
    const out = join("public", "icons", `icon-${size}.png`);
    await page.locator("svg").screenshot({ path: out, omitBackground: false });
    console.log(`wrote ${out}`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
