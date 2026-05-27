# thb-dashboard

Mobile-first Next.js 14 dashboard for tracking THB-relevant macro signals
(USD/THB, DXY, gold, US 10Y, Brent) with derivative-based regime signals.

Stack: Next.js 14 (App Router) · TypeScript · Tailwind · Recharts.

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
npm run test:data    # smoke-test the Yahoo fetchers + derivative math
npm run build
```
