/**
 * Smoke test for the data layer. Run with:
 *   npm run test:data
 *
 * Hits the configured upstream for each ticker (Frankfurter / FRED / Stooq),
 * prints head/tail of the series, then runs derivatives + z-scores on USD/THB
 * and prints the latest values so the math can be eyeballed.
 */

import {
  fetchUsdThb,
  fetchDxy,
  fetchGold,
  fetchUs10y,
  fetchBrent,
  type DailyPoint,
} from "../lib/fetchers";
import { computeDerivatives } from "../lib/derivatives";
import { rollingZ, latestZ } from "../lib/zscore";

function preview(label: string, series: DailyPoint[]): void {
  if (series.length === 0) {
    console.log(`  ${label}: <empty>`);
    return;
  }
  const head = series[0];
  const tail = series[series.length - 1];
  console.log(
    `  ${label.padEnd(10)} n=${String(series.length).padStart(4)}  ` +
      `first ${head.date} ${head.close.toFixed(4)}  ` +
      `last  ${tail.date} ${tail.close.toFixed(4)}`,
  );
}

async function main(): Promise<void> {
  console.log("Fetching 1y daily series from Yahoo...\n");

  const [thb, dxy, gold, us10y, brent] = await Promise.all([
    fetchUsdThb("1y"),
    fetchDxy("1y"),
    fetchGold("1y"),
    fetchUs10y("1y"),
    fetchBrent("1y"),
  ]);

  preview("USD/THB", thb);
  preview("DXY", dxy);
  preview("Gold", gold);
  preview("US 10Y%", us10y);
  preview("Brent", brent);

  console.log("\nDerivatives on USD/THB (5-day smoothing, then centered diffs):");
  const d = computeDerivatives(thb, 5);
  console.log(
    `  smoothed=${d.smoothed.length}  velocity=${d.velocity.length}  ` +
      `accel=${d.acceleration.length}  jerk=${d.jerk.length}`,
  );

  const last = (arr: { date: string; value: number }[]) =>
    arr.length ? `${arr[arr.length - 1].date} ${arr[arr.length - 1].value.toFixed(6)}` : "<empty>";
  console.log(`  latest smoothed:     ${last(d.smoothed)}`);
  console.log(`  latest velocity:     ${last(d.velocity)}`);
  console.log(`  latest acceleration: ${last(d.acceleration)}`);
  console.log(`  latest jerk:         ${last(d.jerk)}`);

  console.log("\nZ-scores of derivatives vs trailing 126-day window:");
  const zV = rollingZ(d.velocity);
  const zA = rollingZ(d.acceleration);
  const zJ = rollingZ(d.jerk);
  const fmt = (z: number | null) => (z == null ? "n/a (window not full)" : z.toFixed(3));
  console.log(`  velocity z:     ${fmt(latestZ(zV))}`);
  console.log(`  acceleration z: ${fmt(latestZ(zA))}`);
  console.log(`  jerk z:         ${fmt(latestZ(zJ))}`);

  console.log("\nOK — data layer is responsive.");
}

main().catch((err: unknown) => {
  console.error("\nFAIL —", err instanceof Error ? err.message : err);
  process.exit(1);
});
