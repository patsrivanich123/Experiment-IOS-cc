# thb-dashboard

Mobile-first Next.js 14 dashboard for tracking THB-relevant macro signals
(USD/THB, DXY, gold, US 10Y, Brent) with derivative-based regime signals.

Stack: Next.js 14 (App Router) · TypeScript · Tailwind · Recharts.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fpatsrivanich123%2FExperiment-IOS-cc&project-name=thb-dashboard&repository-name=thb-dashboard)

Vercel auto-detects this as a Next.js project — no env vars required. Yahoo's
chart endpoints are unauth'd. After importing, set the **production branch**
to whichever branch you want to deploy (this work currently lives on
`claude/thb-dashboard-nextjs-vgcfL` until merged to `main`).

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
npm run test:data    # smoke-test the Yahoo fetchers + derivative math
npm run screenshot   # capture mobile-viewport PNGs into ./screenshots/
npm run build
```

## Layout

```
app/
  api/{fx,gold,rates,reer}/route.ts   GET handlers wrapping the fetchers
  page.tsx                            single-column mobile layout
components/
  HeadlineTiles.tsx                   USD/THB spot + 1d/5d/30d % change
  GoldSignalPanel.tsx                 30d chart + v/a/j z-scores + regime
  FXContext.tsx                       1y USD/THB w/ MA20+MA60 + DXY + 10Y
  REERPanel.tsx                       monthly REER (stub until v1.1)
  Footer.tsx                          last-refresh + source attribution
lib/
  fetchers.ts                         Yahoo v8 chart endpoint, typed
  derivatives.ts                      5d centered MA → centered diffs
  zscore.ts                           trailing 126d (6mo) z-score
  movingAverage.ts                    trailing SMA
  format.ts                           formatting helpers
scripts/
  test-data.ts                        data-layer smoke test
  screenshot.ts                       headless mobile screenshot pass
```

## Signals

- **Derivatives** — 5-day centered moving-average smoother applied
  *before* taking 1st/2nd/3rd centered finite differences (velocity,
  acceleration, jerk). Smoothing after differentiating would amplify the
  noise the smoother is meant to suppress.
- **Z-scores** — sample stdev (`n-1`) against a trailing 126-trading-day
  window, current point included. Roughly six months of history is
  needed before z-scores populate.
- **Gold regime** — `velocity z` and `acceleration z` against ±1σ
  thresholds: bull/bear accel, bull/bear losing steam, or neutral.

## Data sources

Yahoo Finance unofficial `v8/finance/chart` endpoint for spot FX, gold,
US 10Y (`^TNX`, already in percent), and Brent. REER returns a stub
series — real BIS scraping is v1.1.

Not investment advice.
