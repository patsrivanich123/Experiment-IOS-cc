/**
 * Mobile-viewport screenshot pass over the dashboard.
 * Boots a headless chromium against the already-running dev server.
 */

import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const URL = process.env.URL ?? "http://localhost:3010/";
const OUT_DIR = "screenshots";

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    headless: true,
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await ctx.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  console.log(`Loading ${URL}`);
  await page.goto(URL, { waitUntil: "networkidle", timeout: 30_000 });

  // Give the charts a beat to settle.
  await page.waitForTimeout(1500);

  // Full-page screenshot for the README / verification.
  await page.screenshot({
    path: `${OUT_DIR}/dashboard-full.png`,
    fullPage: true,
  });
  console.log("wrote screenshots/dashboard-full.png");

  // Above-the-fold viewport screenshot (what loads first on a phone).
  await page.screenshot({ path: `${OUT_DIR}/dashboard-viewport.png` });
  console.log("wrote screenshots/dashboard-viewport.png");

  // Sanity-check: text we expect on the page.
  const bodyText = await page.locator("body").innerText();
  const expectations = [
    "THB Dashboard",
    "USD/THB",
    "Gold (XAU)",
    "FX Context",
    "Real Effective Exchange Rate",
    "Last refresh:",
  ];
  const missing = expectations.filter((s) => !bodyText.includes(s));
  console.log(`\nText probe — missing: ${missing.length === 0 ? "none" : missing.join(", ")}`);

  // Look for visible error banners produced by PanelError.
  const errorCount = await page.locator('text="Failed to load:"').count();
  console.log(`Error banners visible: ${errorCount}`);

  if (consoleErrors.length > 0) {
    console.log("\nConsole errors:");
    for (const e of consoleErrors) console.log(`  - ${e}`);
  } else {
    console.log("\nNo console errors.");
  }

  await browser.close();

  if (missing.length > 0 || errorCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
