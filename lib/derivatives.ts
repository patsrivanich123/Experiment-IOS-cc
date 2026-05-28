/**
 * Numerical derivatives for time-series of (date, close) points.
 *
 * Pipeline: smooth FIRST (5-day centered MA), then take centered finite
 * differences. Differentiating raw daily prices amplifies noise; the prior
 * smoothing pass is what makes velocity/acceleration/jerk readable.
 *
 * All series are evenly spaced by trading-day index (dt = 1), so derivatives
 * are reported in "per trading day" units. Endpoints where the centered
 * window can't be applied are dropped — output is shorter than input.
 */

import type { DailyPoint } from "./fetchers";

export type DerivativePoint = {
  date: string;
  value: number;
};

export type DerivativeBundle = {
  /** Smoothed level (5-day centered MA). */
  smoothed: DerivativePoint[];
  /** 1st derivative — velocity, units / trading day. */
  velocity: DerivativePoint[];
  /** 2nd derivative — acceleration. */
  acceleration: DerivativePoint[];
  /** 3rd derivative — jerk. */
  jerk: DerivativePoint[];
};

/**
 * Centered moving average. Window must be odd; output length = input - (window-1).
 * Dates are taken from the center of each window.
 */
export function centeredMA(
  series: DailyPoint[],
  window = 5,
): DerivativePoint[] {
  if (window % 2 === 0) {
    throw new Error(`centeredMA window must be odd, got ${window}`);
  }
  if (series.length < window) return [];

  const half = (window - 1) / 2;
  const out: DerivativePoint[] = [];

  for (let i = half; i < series.length - half; i++) {
    let sum = 0;
    for (let j = i - half; j <= i + half; j++) sum += series[j].close;
    out.push({ date: series[i].date, value: sum / window });
  }
  return out;
}

/**
 * Centered first difference on an evenly-spaced series:
 *   d[i] = (s[i+1] - s[i-1]) / 2
 * Drops the first and last point.
 */
export function centeredDiff(series: DerivativePoint[]): DerivativePoint[] {
  if (series.length < 3) return [];
  const out: DerivativePoint[] = [];
  for (let i = 1; i < series.length - 1; i++) {
    out.push({
      date: series[i].date,
      value: (series[i + 1].value - series[i - 1].value) / 2,
    });
  }
  return out;
}

/**
 * Smooth (5-day centered MA by default), then take 1st/2nd/3rd centered
 * differences. Each derivative pass drops one point from each end.
 */
export function computeDerivatives(
  series: DailyPoint[],
  smoothingWindow = 5,
): DerivativeBundle {
  const smoothed = centeredMA(series, smoothingWindow);
  const velocity = centeredDiff(smoothed);
  const acceleration = centeredDiff(velocity);
  const jerk = centeredDiff(acceleration);
  return { smoothed, velocity, acceleration, jerk };
}
