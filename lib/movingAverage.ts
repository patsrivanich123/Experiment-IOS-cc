/**
 * Trailing simple moving average. Output is aligned with input length;
 * positions before the window is full are returned as null.
 */

import type { DailyPoint } from "./fetchers";

export type MaPoint = {
  date: string;
  ma: number | null;
};

export function trailingSMA(series: DailyPoint[], window: number): MaPoint[] {
  if (window < 1) throw new Error("trailingSMA window must be >= 1");

  const out: MaPoint[] = [];
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    sum += series[i].close;
    if (i >= window) sum -= series[i - window].close;

    if (i >= window - 1) {
      out.push({ date: series[i].date, ma: sum / window });
    } else {
      out.push({ date: series[i].date, ma: null });
    }
  }
  return out;
}
