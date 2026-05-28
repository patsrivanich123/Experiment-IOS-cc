# CLAUDE.md

Notes for Claude (or any agent) picking up this repo cold. Skim this before
making changes — most of it is hard-won context that isn't obvious from the
code or git log alone.

## What this is

Mobile-first Next.js 14 dashboard tracking THB-relevant macro signals
(USD/THB, DXY, gold, US 10Y, Brent) with derivative-based regime signals.
Single-column layout, optimized for iPhone-sized viewports. Lives at the
project's Vercel URL; `main` auto-deploys.

Stack: Next.js 14 (App Router) · TypeScript (strict, **no `any`**) · Tailwind
3 · Recharts. No other UI libs.

## Critical: do NOT use Yahoo Finance

The original implementation hit `query{1,2}.finance.yahoo.com/v8/finance/chart`.
**This works locally but 429s on Vercel** — Yahoo rate-limits AWS Lambda IP
ranges aggressively. We discovered this in production after the dashboard
returned `Failed to load: Yahoo HTTP 429 from query2...` on every panel.

The data layer (`lib/fetchers.ts`) now uses:

| Ticker  | Source                                | Notes                                                                                     |
| ------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| USD/THB | Frankfurter (ECB-backed)              | `https://api.frankfurter.dev/v1/{from}..{to}?from=USD&to=THB` — clean JSON timeseries.    |
| DXY     | FRED `DTWEXBGS` (broad dollar idx)    | **Not** the literal ICE DXY basket. Daily; same momentum signal. ~120 vs ICE's ~100.      |
| US 10Y  | FRED `DGS10`                          | Constant-maturity yield, daily, percent.                                                  |
| Brent   | FRED `DCOILBRENTEU`                   | Spot, USD/bbl, daily.                                                                     |
| Gold    | `@fawazahmed0/currency-api` via jsDelivr CDN | One HTTP request per trading day, fanned out in parallel. ~3s for 1y from the CDN.  |

### Gotchas baked into the fetchers

- **FRED is fronted by Cloudflare** and **503s Node's default UA**. The shared
  `fetchText` helper sends `User-Agent: curl/8.0` unless `browserLike: true`
  is passed. Do not put back a browser UA on FRED — it will break.
- **Gold weekend carry-forwards**: currency-api carries the prior fixing forward
  on weekends/holidays. `fetchGold` de-dupes adjacent-equal closes so the
  velocity/acceleration pipeline isn't flat-spotted.
- **Frankfurter doesn't have metals.** Don't try `from=USD&to=XAU` — it 422s.
- **Stooq is blocked in this container** (timeout) and now requires an API key
  anyway. Don't reach for it.
- All API routes pin `preferredRegion = "iad1"` (US East) so upstream latency
  is predictable.

## Layout

```
app/
  api/{fx,gold,rates,reer}/route.ts   GET handlers, force-dynamic, no cache
  page.tsx                            mobile single-column mount
components/
  HeadlineTiles.tsx                   USD/THB spot + 1d / 5d / 30d % change
  GoldSignalPanel.tsx                 30d chart + v/a/j z-tiles + regime label
  FXContext.tsx                       1y USD/THB w/ MA20+MA60 + DXY + 10Y mini
  REERPanel.tsx                       stub series, marked with STUB badge
  Footer.tsx                          last-refresh + source attribution
  Panel.tsx                           shared card + skeleton + error states
lib/
  fetchers.ts                         multi-source data layer (see above)
  derivatives.ts                      5d centered MA → centered finite diffs
  zscore.ts                           trailing 126d (6mo) z-score, sample stdev
  movingAverage.ts                    trailing SMA
  format.ts                           tiny formatting helpers
scripts/
  test-data.ts                        npm run test:data — hits live upstreams
  screenshot.ts                       npm run screenshot — headless mobile pass
                                      (requires `npm i playwright-core` first)
```

## Signal math — keep this invariant

- Derivatives **smooth before differentiating**, never after. 5-day centered
  moving average → centered finite differences for velocity, acceleration,
  jerk. Differentiating raw daily prices first amplifies the noise the
  smoother is meant to suppress.
- Z-scores: trailing 126 trading days (~6mo), sample stdev (`n-1`), **current
  point included in the window**. Roughly 6 months of history must elapse
  before z-scores populate; in the meantime `latestZ` returns `null` and the
  regime classifier returns "Insufficient history".
- Gold regime thresholds are ±1σ. If the user wants to tune, edit
  `classifyRegime()` in `components/GoldSignalPanel.tsx`.

## Workflow

- **Push to `main` → Vercel auto-deploys** in ~90s. Production URL is
  `thb-dashboards.vercel.app` (the original `thb-dashboard.vercel.app` slug
  was burned during the deploy debugging — long story; see the PR #1 thread).
- Branch policy: the user's standing instruction is to develop on
  `claude/thb-dashboard-nextjs-vgcfL`, but that branch was merged on first
  ship. For small hotfixes the user has authorized pushing directly to
  `main`. For larger work, open a new feature branch + PR.
- Type-check (`npx tsc --noEmit`) and `next build` both pass cleanly. If
  either breaks, the deploy breaks. Verify locally before pushing.
- **Excluding `scripts/` from tsconfig is load-bearing.** `scripts/screenshot.ts`
  imports `playwright-core` which is intentionally NOT in `package.json` (it's
  a dev-only verification tool). If `scripts/` re-enters `tsconfig.include`,
  Vercel's type check will fail. Don't reverse this.

## Stubs / v1.1 TODOs

- **REER** (`/api/reer`) returns a hand-rolled monthly path. Real BIS effective
  exchange rate scraping is deferred to v1.1. The `STUB` badge in the UI is
  meaningful, don't remove it without wiring the real source.
- **DXY** is a *proxy* (FRED's broad trade-weighted index, not ICE's 6-currency
  basket). If a paid source ever ships, swap `fetchDxy` to use it; the UI
  doesn't need to change.
- **Caching**: API routes are `force-dynamic`, every page load re-hits
  upstream. Fine for personal use; add ISR or a small in-memory dedupe if
  the dashboard ever sees real traffic.

## When in doubt

- Run `npm run test:data` to confirm the data layer is alive before
  touching UI — most failures since launch have been upstream issues, not
  code bugs.
- If a panel shows "Failed to load: \<source\>: HTTP \<code\>", the error
  banner tells you exactly which upstream broke. Read it before guessing.

## Not in this file

Routine stuff (no `any`, Tailwind only, mobile-first, single-column) is in
the user's project preferences and shouldn't be repeated here. This file
captures what's specific to *this* dashboard and would be lost otherwise.
