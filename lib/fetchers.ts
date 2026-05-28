/**
 * Yahoo Finance unofficial chart endpoint wrappers.
 *
 * Endpoint shape:
 *   https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}?range={range}&interval={interval}
 * Returns daily candles; we only keep adjusted/close + timestamp.
 *
 * Reverse-engineered, undocumented, no API key. Subject to change or rate-limit;
 * callers should handle errors. NOT for redistribution at scale.
 */

export type DailyPoint = {
  /** ISO date string, YYYY-MM-DD, in UTC. */
  date: string;
  /** Adjusted close if available, else close. */
  close: number;
};

export type Ticker =
  | "THB=X"      // USD/THB spot
  | "DX-Y.NYB"   // DXY dollar index
  | "GC=F"       // Gold front-month future
  | "^TNX"       // US 10Y yield (×10; 4.25% reported as 42.5)
  | "BZ=F";      // Brent front-month future

export type YahooRange = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "max";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

/**
 * Yahoo's chart endpoint returns this (only the shape we use is typed).
 */
type YahooChartResponse = {
  chart: {
    result:
      | [
          {
            timestamp?: number[];
            indicators: {
              quote: [{ close: (number | null)[] }];
              adjclose?: [{ adjclose: (number | null)[] }];
            };
          },
        ]
      | null;
    error: { code: string; description: string } | null;
  };
};

function toIsoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Low-level fetch of daily candles from Yahoo Finance.
 * Throws on HTTP errors, missing data, or API-level errors.
 */
export async function fetchDaily(
  ticker: Ticker,
  range: YahooRange = "1y",
): Promise<DailyPoint[]> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(ticker)}?range=${range}&interval=1d&includePrePost=false&events=div%2Csplit`;

  const res = await fetch(url, {
    headers: {
      // Yahoo returns 401 / Edge-blocked HTML to default Node UA; mimic a browser.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
    },
    // Always go to network in route handlers; let callers add caching.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Yahoo HTTP ${res.status} for ${ticker}`);
  }

  const json = (await res.json()) as YahooChartResponse;

  if (json.chart.error) {
    throw new Error(
      `Yahoo error for ${ticker}: ${json.chart.error.code} ${json.chart.error.description}`,
    );
  }

  const result = json.chart.result?.[0];
  if (!result || !result.timestamp) {
    throw new Error(`Yahoo returned no data for ${ticker}`);
  }

  const ts = result.timestamp;
  const closes = result.indicators.quote[0].close;
  const adj = result.indicators.adjclose?.[0].adjclose;

  const out: DailyPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const raw = adj?.[i] ?? closes[i];
    if (raw == null || Number.isNaN(raw)) continue;
    out.push({ date: toIsoDate(ts[i]), close: raw });
  }
  return out;
}

// Convenience wrappers per ticker — keep call sites readable.
export const fetchUsdThb = (range: YahooRange = "1y"): Promise<DailyPoint[]> =>
  fetchDaily("THB=X", range);

export const fetchDxy = (range: YahooRange = "1y"): Promise<DailyPoint[]> =>
  fetchDaily("DX-Y.NYB", range);

export const fetchGold = (range: YahooRange = "1y"): Promise<DailyPoint[]> =>
  fetchDaily("GC=F", range);

/**
 * US 10Y yield (^TNX). Yahoo reports this in percent directly
 * (e.g. 4.43 = 4.43%), so no scaling here.
 */
export const fetchUs10y = (range: YahooRange = "1y"): Promise<DailyPoint[]> =>
  fetchDaily("^TNX", range);

export const fetchBrent = (range: YahooRange = "1y"): Promise<DailyPoint[]> =>
  fetchDaily("BZ=F", range);
