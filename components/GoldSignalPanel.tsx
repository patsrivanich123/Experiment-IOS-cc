"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { GoldResponse } from "@/app/api/gold/route";
import { computeDerivatives } from "@/lib/derivatives";
import { rollingZ, latestZ } from "@/lib/zscore";
import { Panel, PanelSkeleton, PanelError } from "./Panel";
import { deltaColor, fmtNum, fmtSignedNum, shortDate } from "@/lib/format";

type Regime = {
  label: string;
  tone: "up" | "down" | "neutral" | "warn";
  detail: string;
};

/**
 * Crude regime classifier based on velocity / acceleration z-scores.
 * Designed to flag *acceleration*, not just direction.
 */
function classifyRegime(zV: number | null, zA: number | null): Regime {
  if (zV == null || zA == null) {
    return {
      label: "Insufficient history",
      tone: "neutral",
      detail: "Need ≥ 126 trading days for z-scores.",
    };
  }
  if (zV > 1 && zA > 1) {
    return {
      label: "Bull acceleration",
      tone: "up",
      detail: "Velocity and acceleration both > +1σ.",
    };
  }
  if (zV < -1 && zA < -1) {
    return {
      label: "Bear acceleration",
      tone: "down",
      detail: "Velocity and acceleration both < −1σ.",
    };
  }
  if (zV > 1 && zA < -1) {
    return {
      label: "Bull losing steam",
      tone: "warn",
      detail: "Trending up, but acceleration < −1σ.",
    };
  }
  if (zV < -1 && zA > 1) {
    return {
      label: "Bear losing steam",
      tone: "warn",
      detail: "Trending down, but acceleration > +1σ.",
    };
  }
  return {
    label: "Neutral / mixed",
    tone: "neutral",
    detail: "Velocity and acceleration within ±1σ.",
  };
}

const TONE_CLASS: Record<Regime["tone"], string> = {
  up: "bg-up-soft text-up ring-up/30",
  down: "bg-down-soft text-down ring-down/30",
  warn: "bg-accent/10 text-accent ring-accent/30",
  neutral: "bg-border/30 text-muted ring-border",
};

export function GoldSignalPanel() {
  const [data, setData] = useState<GoldResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gold?range=1y")
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return (await r.json()) as GoldResponse;
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
      title="Gold · XAU/USD"
      subtitle="30-day path with derivative-based regime signal"
    >
      {error && <PanelError message={error} />}
      {!error && !data && <PanelSkeleton height={300} />}
      {!error && data && <Body data={data} />}
    </Panel>
  );
}

function Body({ data }: { data: GoldResponse }) {
  const { last30, derivs, zV, zA, zJ, regime } = useMemo(() => {
    const last30 = data.gold.slice(-30);
    const derivs = computeDerivatives(data.gold, 5);
    const zV = latestZ(rollingZ(derivs.velocity));
    const zA = latestZ(rollingZ(derivs.acceleration));
    const zJ = latestZ(rollingZ(derivs.jerk));
    const regime = classifyRegime(zV, zA);
    return { last30, derivs, zV, zA, zJ, regime };
  }, [data]);

  const latestSmoothed = derivs.smoothed[derivs.smoothed.length - 1]?.value ?? null;
  const last = last30[last30.length - 1]?.close ?? null;
  const first = last30[0]?.close ?? null;
  const pct30 = last != null && first != null ? (last - first) / first : 0;

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[40px] font-semibold leading-none tracking-tightest text-text">
            {last != null ? fmtNum(last, 1) : "—"}
          </div>
          <div className="mt-1.5 text-[11px] uppercase tracking-wider text-muted-soft">
            USD per troy ounce
          </div>
        </div>
        <DeltaChip value={pct30} label="30d" />
      </div>

      <div className="-mx-1 h-40 w-[calc(100%+0.5rem)]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={last30} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#161a23" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: "#7a8294", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={26}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "#7a8294", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={42}
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
              formatter={(v: number) => [fmtNum(v, 1), "XAU/USD"]}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke="#fbbf24"
              strokeWidth={2}
              fill="url(#goldFill)"
              dot={false}
              activeDot={{ r: 4, fill: "#fbbf24", stroke: "#10131a", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <ZTile label="velocity" z={zV} />
        <ZTile label="accel" z={zA} />
        <ZTile label="jerk" z={zJ} />
      </div>

      <div
        className={`mt-4 rounded-2xl px-3.5 py-3 ring-1 ${TONE_CLASS[regime.tone]}`}
      >
        <div className="flex items-center gap-2">
          <Dot tone={regime.tone} />
          <div className="text-[14px] font-semibold">{regime.label}</div>
        </div>
        <div className="mt-1 text-[12px] opacity-80">{regime.detail}</div>
      </div>

      {latestSmoothed != null && (
        <div className="mt-2.5 text-[11px] text-muted-soft">
          5-day smoothed: <span className="font-mono">{fmtNum(latestSmoothed, 1)}</span>
        </div>
      )}
    </div>
  );
}

function ZTile({ label, z }: { label: string; z: number | null }) {
  const color = z == null ? "text-muted-soft" : deltaColor(z);
  return (
    <div className="rounded-2xl border border-border-soft bg-bg/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-soft">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-[20px] font-semibold tabular-nums leading-none ${color}`}>
        {z == null ? "—" : fmtSignedNum(z)}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-soft">σ</div>
    </div>
  );
}

function DeltaChip({ value, label }: { value: number; label: string }) {
  const positive = value > 0;
  const negative = value < 0;
  const bg = positive ? "bg-up-soft" : negative ? "bg-down-soft" : "bg-border/40";
  const color = positive ? "text-up" : negative ? "text-down" : "text-muted";
  const sign = positive ? "+" : "";
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${bg} ${color}`}
    >
      <span className="font-mono tabular-nums">
        {sign}
        {(value * 100).toFixed(2)}%
      </span>
      <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
    </div>
  );
}

function Dot({ tone }: { tone: Regime["tone"] }) {
  const color =
    tone === "up"
      ? "bg-up"
      : tone === "down"
      ? "bg-down"
      : tone === "warn"
      ? "bg-accent"
      : "bg-muted";
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${color}`}
      />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}
