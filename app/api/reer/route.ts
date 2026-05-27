import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type ReerPoint = {
  /** Month-end ISO date YYYY-MM-DD. */
  date: string;
  /** REER index, base 2020 = 100. */
  value: number;
};

export type ReerResponse = {
  /** True until real BIS scraping ships (v1.1). */
  stub: true;
  source: "stub";
  series: ReerPoint[];
  fetchedAt: string;
  note: string;
};

/**
 * Hand-rolled monthly path that loosely tracks the THB REER's recent shape
 * (drift down ~mid-2024, choppy recovery into early 2026). Purely illustrative —
 * does NOT come from BIS and should not be used for decisions.
 */
const STUB_SERIES: ReerPoint[] = [
  { date: "2024-06-30", value: 100.4 },
  { date: "2024-07-31", value: 100.9 },
  { date: "2024-08-31", value: 101.3 },
  { date: "2024-09-30", value: 102.0 },
  { date: "2024-10-31", value: 101.2 },
  { date: "2024-11-30", value: 100.1 },
  { date: "2024-12-31", value: 99.4 },
  { date: "2025-01-31", value: 98.7 },
  { date: "2025-02-28", value: 98.9 },
  { date: "2025-03-31", value: 99.5 },
  { date: "2025-04-30", value: 100.2 },
  { date: "2025-05-31", value: 100.8 },
  { date: "2025-06-30", value: 101.1 },
  { date: "2025-07-31", value: 101.4 },
  { date: "2025-08-31", value: 100.9 },
  { date: "2025-09-30", value: 100.3 },
  { date: "2025-10-31", value: 100.6 },
  { date: "2025-11-30", value: 101.0 },
  { date: "2025-12-31", value: 101.3 },
  { date: "2026-01-31", value: 101.5 },
  { date: "2026-02-28", value: 101.2 },
  { date: "2026-03-31", value: 100.8 },
  { date: "2026-04-30", value: 101.1 },
];

export function GET(): NextResponse {
  const body: ReerResponse = {
    stub: true,
    source: "stub",
    series: STUB_SERIES,
    fetchedAt: new Date().toISOString(),
    note: "Stub data. Real BIS REER scraping ships in v1.1.",
  };
  return NextResponse.json(body);
}
