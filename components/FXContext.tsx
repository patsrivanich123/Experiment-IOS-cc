"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
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
    const readJsonOrError = async <T,>(r: Response, label: string): Promise<T> => {
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(`${label}: ${body.error ?? `HTTP ${r.status}`}`);
      }
      return (await r.json()) as T;
    };
    Promise.all([
      fetch("/api/fx?range=1y").then((r) => readJsonOrError<FxResponse>(r, "fx")),
      fetch("/api/rates?range=1y").then((r) => readJsonOrError<RatesResponse>(r, "rates")),
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
      title="FX Context"
      subtitle="1-year USD/THB with 20d & 60d trend, DXY overlay, US 10Y"
    >
      {error && <PanelError message={error} />}
      {!error && (!fx || !rates) && <PanelSkeleton height={300} />}
      {!error && fx && rates && <Body fx={fx} rates={rates} />}
    </Panel>
  );
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-soft">
      <span className="h-0.5 w-3.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Body({ fx, rates }: { fx: FxResponse; rates: RatesResponse }) {
  const rows = useMemo(() => buildRows(fx.usdThb, fx.dxy), [fx]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <LegendPill color="#7dd3fc" label="USD/THB" />
        <LegendPill color="#eaecf2" label="MA20" />
        <LegendPill color="#525a6b" label="MA60" />
        <LegendPill color="#fbbf24" label="DXY" />
      </div>

      <div className="-mx-1 h-56 w-[calc(100%+0.5rem)]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#161a23" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: "#7a8294", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis
              yAxisId="thb"
              domain={["auto", "auto"]}
              tick={{ fill: "#7a8294", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <YAxis
              yAxisId="dxy"
              orientation="right"
              domain={["auto", "auto"]}
              tick={{ fill: "#7a8294", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={34}
              tickFormatter={(v: number) => v.toFixed(0)}
            />
            <Tooltip
              cursor={{ stroke: "#2a3142", strokeWidth: 1 }}
              contentStyle={{
                background: "#10131a",
                border: "1px solid #1f2430",
                borderRadius: 12,
                fontSize: 12,
                boxShadow: "0 8px 24px -12px rgba(0,0,0,0.6)",
              }}
              labelStyle={{ color: "#7a8294", fontSize: 11 }}
              labelFormatter={(v: string) => shortDate(v)}
              formatter={(v, name) => {
                const n = typeof v === "number" ? v : Number(v);
                const label = String(name);
                return Number.isFinite(n) ? [fmtNum(n, 3), label] : ["—", label];
              }}
            />
            <Line
              yAxisId="thb"
              type="monotone"
              dataKey="thb"
              name="USD/THB"
              stroke="#7dd3fc"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#7dd3fc", stroke: "#10131a", strokeWidth: 2 }}
            />
            <Line
              yAxisId="thb"
              type="monotone"
              dataKey="thbMA20"
              name="MA20"
              stroke="#eaecf2"
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeDasharray="2 4"
              dot={false}
              connectNulls
            />
            <Line
              yAxisId="thb"
              type="monotone"
              dataKey="thbMA60"
              name="MA60"
              stroke="#525a6b"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
            />
            <Line
              yAxisId="dxy"
              type="monotone"
              dataKey="dxy"
              name="DXY"
              stroke="#fbbf24"
              strokeOpacity={0.85}
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 rounded-2xl border border-border-soft bg-bg/40 p-3.5">
        <div className="mb-1.5 flex items-baseline justify-between">
          <h3 className="text-[12.5px] font-medium text-text-dim">
            US 10-Year Treasury
          </h3>
          <div className="font-mono text-[14px] font-semibold tabular-nums text-text">
            {rates.us10y.length > 0
              ? `${rates.us10y[rates.us10y.length - 1].close.toFixed(2)}%`
              : "—"}
          </div>
        </div>
        <div className="-mx-1 h-20 w-[calc(100%+0.5rem)]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rates.us10y} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fill: "#7a8294", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "#7a8294", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                width={28}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip
                cursor={{ stroke: "#2a3142", strokeWidth: 1 }}
                contentStyle={{
                  background: "#10131a",
                  border: "1px solid #1f2430",
                  borderRadius: 10,
                  fontSize: 11,
                }}
                labelStyle={{ color: "#7a8294", fontSize: 10 }}
                labelFormatter={(v: string) => shortDate(v)}
                formatter={(v: number) => [`${v.toFixed(2)}%`, "10Y"]}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#a78bfa"
                strokeWidth={1.75}
                fill="url(#rateFill)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
