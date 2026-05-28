import { NextResponse } from "next/server";
import { fetchUs10y, type DailyPoint, type Range } from "@/lib/fetchers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = "iad1";

export type RatesResponse = {
  us10y: DailyPoint[];
  range: Range;
  fetchedAt: string;
};

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") ?? "1y") as Range;

  try {
    const us10y = await fetchUs10y(range);
    const body: RatesResponse = {
      us10y,
      range,
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[api/rates] upstream failed:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
