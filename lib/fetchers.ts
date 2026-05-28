/**
 * Multi-source data fetchers.
 *
 * Yahoo Finance was the original source for everything but rate-limits AWS
 * Lambda IPs aggressively (429), so the dashboard 502'd in production. We now
 * route each ticker to whichever free, datacenter-friendly endpoint serves it
 * best, normalizing to a common DailyPoint[] shape.
 *
 *   USD/THB → Frankfurter (ECB-based, daily)
 *   DXY     → FRED DTWEXBGS (Broad Dollar Index — closest free daily proxy)
 *   US 10Y  → FRED DGS10 (daily, percent)
 *   Brent   → FRED DCOILBRENTEU (daily, USD/bbl)
 *   Gold    → Stooq xauusd (CSV; if blocked, the route handler surfaces the error)
 *
 * All endpoints used here are unauthenticated and ToS-compatible for personal use.
 */

export type DailyPoint = {
  /** ISO date string, YYYY-MM-DD. */
  date: string;
  close: number;
};

/** Date-range strings accepted by the public API routes. */
export type Range = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";

const RANGE_DAYS: Record<Range, number> = {
  "1mo": 31,
  "3mo": 93,
  "6mo": 186,
  "1y": 366,
  "2y": 731,
  "5y": 1827,
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function startDate(range: Range): string {
  return isoDaysAgo(RANGE_DAYS[range]);
}

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Plain text fetch. Some upstreams (FRED behind Cloudflare) actively 503
 * requests with browser UAs because they assume scrapers, while accepting
 * the runtime default UA cleanly. So `browserLike` is opt-in per source.
 */
async function fetchText(
  url: string,
  label: string,
  opts: { browserLike?: boolean } = {},
): Promise<string> {
  // Cloudflare in front of fred.stlouisfed.org 503s Node's default UA, but
  // accepts CLI-style UAs (curl, wget, python-requests). Spoof curl unless
  // the caller specifically needs a browser UA (Stooq's WAF prefers browser).
  const headers: Record<string, string> = {
    Accept: "text/csv,application/json,*/*",
    "User-Agent": opts.browserLike ? BROWSER_UA : "curl/8.0",
  };

  const res = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} from ${new URL(url).host}`);
  return res.text();
}

// ──────────────────────── Frankfurter (ECB) ────────────────────────

type FrankfurterTimeseries = {
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, Record<string, number>>;
};

/**
 * Frankfurter exposes ECB reference rates as a clean JSON timeseries.
 * THB is published as part of the ECB euro-reference fixings.
 */
export async function fetchUsdThb(range: Range = "1y"): Promise<DailyPoint[]> {
  const url = `https://api.frankfurter.dev/v1/${startDate(range)}..${isoToday()}?from=USD&to=THB`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Frankfurter: HTTP ${res.status} for USD→THB`);
  const json = (await res.json()) as FrankfurterTimeseries;

  return Object.entries(json.rates)
    .map(([date, r]) => ({ date, close: r.THB }))
    .filter((p) => typeof p.close === "number")
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ──────────────────────── FRED CSV (no API key) ────────────────────────

/**
 * FRED's `fredgraph.csv` endpoint accepts any public series ID and returns
 * a two-column CSV: observation_date,VALUE. No auth required.
 * Blank values (holidays, weekends, missing prints) come through as "."
 * or empty string; we drop those.
 */
async function fetchFredSeries(seriesId: string, range: Range): Promise<DailyPoint[]> {
  const start = startDate(range);
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${start}`;
  const csv = await fetchText(url, `FRED ${seriesId}`);

  const lines = csv.trim().split("\n");
  const out: DailyPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, raw] = lines[i].split(",");
    if (!date || !raw || raw === "." || raw === "") continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    out.push({ date, close: v });
  }
  return out;
}

/**
 * DXY proxy. The actual DXY (ICE futures, Yahoo's DX-Y.NYB) isn't on FRED;
 * DTWEXBGS is the Fed's trade-weighted broad dollar index, daily, indexed to
 * Jan 2006 = 100. Different basket, but tracks dollar strength similarly —
 * the velocity / momentum *signal* (what we care about) is essentially the same.
 */
export const fetchDxy = (range: Range = "1y"): Promise<DailyPoint[]> =>
  fetchFredSeries("DTWEXBGS", range);

/** US 10Y Treasury constant maturity yield, in percent. */
export const fetchUs10y = (range: Range = "1y"): Promise<DailyPoint[]> =>
  fetchFredSeries("DGS10", range);

/** Brent crude spot, USD per barrel. */
export const fetchBrent = (range: Range = "1y"): Promise<DailyPoint[]> =>
  fetchFredSeries("DCOILBRENTEU", range);

// ──────────────────────── Gold (jsdelivr / currency-api) ────────────────────────

type CurrencyApiPayload = {
  date: string;
  xau: Record<string, number>;
};

/**
 * Fan-out fetch against the community-maintained `@fawazahmed0/currency-api`
 * via jsdelivr's CDN. The API exposes one date per request, but jsdelivr is
 * fast enough that 366 parallel requests for a year of daily gold spots
 * complete in ~3 seconds.
 *
 * Each per-date snapshot publishes XAU → many currencies; xau.usd is the
 * gold price in USD per troy ounce. Weekends/holidays often carry the prior
 * fixing forward; we de-duplicate adjacent identical values to avoid
 * polluting the derivative computations with weekend flatness.
 */
export async function fetchGold(range: Range = "1y"): Promise<DailyPoint[]> {
  const days = RANGE_DAYS[range];

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const results = await Promise.all(
    dates.map(async (date) => {
      try {
        const res = await fetch(
          `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/xau.json`,
          { cache: "no-store", signal: AbortSignal.timeout(7000) },
        );
        if (!res.ok) return null;
        const j = (await res.json()) as CurrencyApiPayload;
        const usd = j.xau?.usd;
        return typeof usd === "number" ? { date, close: usd } : null;
      } catch {
        return null;
      }
    }),
  );

  const ok = results.filter((p): p is DailyPoint => p !== null).sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );

  if (ok.length === 0) throw new Error("Gold: no points returned from currency-api");

  // Drop runs of identical adjacent prices — weekends/holidays carry forward
  // and produce zero-velocity flat spots that distort the derivative pipeline.
  const deduped: DailyPoint[] = [];
  for (const p of ok) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.close !== p.close) deduped.push(p);
  }
  return deduped;
}
