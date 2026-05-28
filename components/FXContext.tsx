"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { FxResponse } from "@/app/api/fx/route";
import type { RatesResponse } from "@/app/api/rates/route";
import type { DailyPoint } from "@/lib/fetchers";
import { trailingSMA } from "@/lib/movingAverage";
import { Panel, PanelSkeleton, PanelError } from "./Panel";
import { fmtNum, shortDate } from "@/lib/format";

type Row = {
  date: string;
  thb: number;
  thbMA20: number | null;
  thbMA60: number | null;
  dxy: number | null;
};

/**
 * Merge USD/THB and DXY by date, computing 20d/60d MAs for THB. DXY is on its
 * own right Y-axis so the two lines share an X but not a scale.
 */
function buildRows(thb: DailyPoint[], dxy: DailyPoint[]): Row[] {
  const ma20 = trailingSMA(thb, 20);
  const ma60 = trailingSMA(thb, 60);
  const dxyByDate = new Map(dxy.map((p) => [p.date, p.close]));

  return thb.map((p, i) => ({
    date: p.date,
    thb: p.close,
    thbMA20: ma20[i].ma,
    thbMA60: ma60[i].ma,
    dxy: dxyByDate.get(p.date) ?? null,
  }));
}

export function FXContext() {
  const [fx, setFx] = useState<FxResponse | null>(null);
  const [rates, setRates] = useState<RatesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/fx?range=1y").then(async (r) => {
        if (!r.ok) throw new Error(`fx HTTP ${r.status}`);
        return (await r.json()) as FxResponse;
      }),
      fetch("/api/rates?range=1y").then(async (r) => {
        if (!r.ok) throw new Error(`rates HTTP ${r.status}`);
        return (await r.json()) as RatesResponse;
      }),
    ])
      .then(([f, r]) => {
        if (cancelled) return;
        setFx(f);
        setRates(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "fetch failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Panel
      title="FX Context — 1y"
      subtitle="USD/THB with 20d & 60d MAs, DXY overlay, US 10Y mini-chart."
    >
      {error && <PanelError message={error} />}
      {!error && (!fx || !rates) && <PanelSkeleton height={300} />}
      {!error && fx && rates && <Body fx={fx} rates={rates} />}
    </Panel>
  );
}

function Body({ fx, rates }: { fx: FxResponse; rates: RatesResponse }) {
  const rows = useMemo(() => buildRows(fx.usdThb, fx.dxy), [fx]);

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1f2430" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: "#8a93a6", fontSize: 10 }}
              minTickGap={32}
              stroke="#1f2430"
            />
            <YAxis
              yAxisId="thb"
              domain={["auto", "auto"]}
              tick={{ fill: "#8a93a6", fontSize: 10 }}
              width={42}
              stroke="#1f2430"
            />
            <YAxis
              yAxisId="dxy"
              orientation="right"
              domain={["auto", "auto"]}
              tick={{ fill: "#8a93a6", fontSize: 10 }}
              width={36}
              stroke="#1f2430"
            />
            <Tooltip
              contentStyle={{
                background: "#11141b",
                border: "1px solid #1f2430",
                fontSize: 12,
              }}
              labelFormatter={(v: string) => shortDate(v)}
              formatter={(v, name) => {
                const n = typeof v === "number" ? v : Number(v);
                const label = String(name);
                return Number.isFinite(n) ? [fmtNum(n, 3), label] : ["—", label];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, color: "#8a93a6" }}
              iconType="plainline"
            />
            <Line
              yAxisId="thb"
              type="monotone"
              dataKey="thb"
              name="USD/THB"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="thb"
              type="monotone"
              dataKey="thbMA20"
              name="MA20"
              stroke="#e6e9ef"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              connectNulls
            />
            <Line
              yAxisId="thb"
              type="monotone"
              dataKey="thbMA60"
              name="MA60"
              stroke="#8a93a6"
              strokeWidth={1}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
            <Line
              yAxisId="dxy"
              type="monotone"
              dataKey="dxy"
              name="DXY"
              stroke="#f59e0b"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">US 10Y yield</h3>
          <div className="text-xs tabular-nums text-muted">
            {rates.us10y.length > 0
              ? `${rates.us10y[rates.us10y.length - 1].close.toFixed(2)}%`
              : "—"}
          </div>
        </div>
        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rates.us10y} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fill: "#8a93a6", fontSize: 9 }}
                minTickGap={40}
                stroke="#1f2430"
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "#8a93a6", fontSize: 9 }}
                width={32}
                stroke="#1f2430"
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip
                contentStyle={{
                  background: "#11141b",
                  border: "1px solid #1f2430",
                  fontSize: 11,
                }}
                labelFormatter={(v: string) => shortDate(v)}
                formatter={(v: number) => `${v.toFixed(2)}%`}
              />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#a78bfa"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
