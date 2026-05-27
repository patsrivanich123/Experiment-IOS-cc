/**
 * Trailing-window z-score for time series.
 *
 * For each point, compute (x - mean) / stdev over the prior N points
 * (default 126 trading days ≈ 6 months). The current point is INCLUDED in
 * the window — this matches how regime signals are usually read ("where is
 * today relative to the last 6 months including today").
 *
 * Output is aligned with input dates; points before the window is full are
 * dropped.
 */

import type { DerivativePoint } from "./derivatives";

export type ZPoint = {
  date: string;
  /** Raw value at this date. */
  value: number;
  /** Z-score vs. trailing window; null if window not yet full. */
  z: number | null;
};

/** ~ 6 trading-months. */
export const SIX_MONTH_WINDOW = 126;

export function rollingZ(
  series: DerivativePoint[],
  window = SIX_MONTH_WINDOW,
): ZPoint[] {
  if (window < 2) throw new Error("rollingZ window must be >= 2");

  const out: ZPoint[] = [];
  for (let i = 0; i < series.length; i++) {
    const start = i - window + 1;
    if (start < 0) {
      out.push({ date: series[i].date, value: series[i].value, z: null });
      continue;
    }

    let sum = 0;
    for (let j = start; j <= i; j++) sum += series[j].value;
    const mean = sum / window;

    let sqsum = 0;
    for (let j = start; j <= i; j++) {
      const d = series[j].value - mean;
      sqsum += d * d;
    }
    // Sample stdev (n - 1) — closer to what you'd report from a finite window.
    const variance = sqsum / (window - 1);
    const stdev = Math.sqrt(variance);

    const z = stdev > 0 ? (series[i].value - mean) / stdev : 0;
    out.push({ date: series[i].date, value: series[i].value, z });
  }
  return out;
}

/**
 * Latest z-score in the series, or null if the trailing window never fills.
 */
export function latestZ(series: ZPoint[]): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].z !== null) return series[i].z;
  }
  return null;
}
