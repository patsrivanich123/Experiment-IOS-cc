/**
 * Small formatting helpers shared across UI components.
 */

export function fmtNum(value: number, digits = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function fmtSignedNum(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

/** Tailwind color class for an up/down/flat number. */
export function deltaColor(value: number): string {
  if (value > 0) return "text-up";
  if (value < 0) return "text-down";
  return "text-muted";
}

/** "May 27" style short date for chart tick labels on small screens. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Wed, May 28" — for the data-as-of stamps under headline numbers. */
export function prettyDate(iso: string): string {
  // Force UTC so the date stamp doesn't shift by ±1 day based on the user's
  // timezone — the underlying series is daily UTC-anchored.
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
