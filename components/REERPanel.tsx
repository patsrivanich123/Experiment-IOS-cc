"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
      title="THB Real Effective Exchange Rate"
      subtitle="Monthly index, base 2020 = 100. Higher = baht overvalued in real terms."
      right={
        <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
          stub
        </span>
      }
    >
      {error && <PanelError message={error} />}
      {!error && !data && <PanelSkeleton height={200} />}
      {!error && data && <Body data={data} />}
    </Panel>
  );
}

function Body({ data }: { data: ReerResponse }) {
  const latest = data.series[data.series.length - 1];

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-2xl font-semibold tabular-nums">
          {latest ? fmtNum(latest.value, 1) : "—"}
        </div>
        {latest && (
          <div className="text-xs text-muted">as of {shortMonth(latest.date)}</div>
        )}
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data.series}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="#1f2430" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={shortMonth}
              tick={{ fill: "#8a93a6", fontSize: 10 }}
              minTickGap={28}
              stroke="#1f2430"
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "#8a93a6", fontSize: 10 }}
              width={40}
              stroke="#1f2430"
            />
            <Tooltip
              contentStyle={{
                background: "#11141b",
                border: "1px solid #1f2430",
                fontSize: 12,
              }}
              labelFormatter={shortMonth}
              formatter={(v: number) => fmtNum(v, 2)}
            />
            <ReferenceLine y={100} stroke="#8a93a6" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-muted">{data.note}</p>
    </div>
  );
}
