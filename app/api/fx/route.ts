import { NextResponse } from "next/server";
import { fetchUsdThb, fetchDxy, type DailyPoint, type YahooRange } from "@/lib/fetchers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Pin to US East — Yahoo's endpoints are far more reliable from US IPs than
// from APAC/EU datacenters.
export const preferredRegion = "iad1";

export type FxResponse = {
  usdThb: DailyPoint[];
  dxy: DailyPoint[];
  range: YahooRange;
  fetchedAt: string;
};

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") ?? "1y") as YahooRange;

  try {
    const [usdThb, dxy] = await Promise.all([fetchUsdThb(range), fetchDxy(range)]);
    const body: FxResponse = {
      usdThb,
      dxy,
      range,
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[api/fx] upstream failed:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
