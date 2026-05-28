"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { ReerResponse } from "@/app/api/reer/route";
import { Panel, PanelSkeleton, PanelError } from "./Panel";
import { fmtNum } from "@/lib/format";

function shortMonth(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function REERPanel() {
  const [data, setData] = useState<ReerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reer")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as ReerResponse;
      })
      .then((d) => {
        if (!cancelled) setData(d);
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
      title="Real Effective Exchange Rate"
      subtitle="Monthly index, base 2020 = 100 · ↑ = baht overvalued in real terms"
      right={
        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent ring-1 ring-accent/30">
          stub
        </span>
      }
    >
      {error && <PanelError message={error} />}
      {!error && !data && <PanelSkeleton height={220} />}
      {!error && data && <Body data={data} />}
    </Panel>
  );
}

function Body({ data }: { data: ReerResponse }) {
  const latest = data.series[data.series.length - 1];

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[40px] font-semibold leading-none tracking-tightest text-text">
            {latest ? fmtNum(latest.value, 1) : "—"}
          </div>
          <div className="mt-1.5 text-[11px] uppercase tracking-wider text-muted-soft">
            {latest ? `as of ${shortMonth(latest.date)}` : "—"}
          </div>
        </div>
      </div>

      <div className="-mx-1 h-44 w-[calc(100%+0.5rem)]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data.series}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="reerFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#161a23" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortMonth}
              tick={{ fill: "#7a8294", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "#7a8294", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={38}
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
              labelFormatter={shortMonth}
              formatter={(v: number) => [fmtNum(v, 2), "REER"]}
            />
            <ReferenceLine
              y={100}
              stroke="#525a6b"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: "100", fill: "#525a6b", fontSize: 9, position: "right" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#reerFill)"
              dot={false}
              activeDot={{ r: 4, fill: "#34d399", stroke: "#10131a", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-soft">{data.note}</p>
    </div>
  );
}
