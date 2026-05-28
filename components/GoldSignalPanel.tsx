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
} from "recharts";
import type { GoldResponse } from "@/app/api/gold/route";
import { computeDerivatives } from "@/lib/derivatives";
import { rollingZ, latestZ } from "@/lib/zscore";
import { Panel, PanelSkeleton, PanelError } from "./Panel";
import { deltaColor, fmtNum, fmtSignedNum, shortDate } from "@/lib/format";

type Regime = {
  label: string;
  className: string;
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
      className: "bg-border/40 text-muted",
      detail: "Need ≥ 126 trading days for z-scores.",
    };
  }
  if (zV > 1 && zA > 1) {
    return {
      label: "Bull acceleration",
      className: "bg-up/15 text-up",
      detail: "Velocity and acceleration both > +1σ.",
    };
  }
  if (zV < -1 && zA < -1) {
    return {
      label: "Bear acceleration",
      className: "bg-down/15 text-down",
      detail: "Velocity and acceleration both < −1σ.",
    };
  }
  if (zV > 1 && zA < -1) {
    return {
      label: "Bull losing steam",
      className: "bg-accent/15 text-accent",
      detail: "Trending up, but acceleration < −1σ.",
    };
  }
  if (zV < -1 && zA > 1) {
    return {
      label: "Bear losing steam",
      className: "bg-accent/15 text-accent",
      detail: "Trending down, but acceleration > +1σ.",
    };
  }
  return {
    label: "Neutral / mixed",
    className: "bg-border/40 text-muted",
    detail: "Velocity and acceleration within ±1σ.",
  };
}

export function GoldSignalPanel() {
  const [data, setData] = useState<GoldResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Need 1y to fill the 126-day z-score window AND show 30d chart.
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
      title="Gold (XAU) — 30d + derivative signals"
      subtitle="Velocity / acceleration / jerk z-scored vs 6-month window."
    >
      {error && <PanelError message={error} />}
      {!error && !data && <PanelSkeleton height={260} />}
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
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-2xl font-semibold tabular-nums">
          {last != null ? fmtNum(last, 1) : "—"}
        </div>
        <div className={`text-sm tabular-nums ${deltaColor(pct30)}`}>
          {(pct30 * 100).toFixed(2)}% <span className="text-muted">30d</span>
        </div>
      </div>

      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={last30} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1f2430" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: "#8a93a6", fontSize: 10 }}
              minTickGap={24}
              stroke="#1f2430"
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "#8a93a6", fontSize: 10 }}
              width={48}
              stroke="#1f2430"
            />
            <Tooltip
              contentStyle={{
                background: "#11141b",
                border: "1px solid #1f2430",
                fontSize: 12,
              }}
              labelFormatter={(v: string) => shortDate(v)}
              formatter={(v: number) => fmtNum(v, 1)}
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke="#facc15"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <ZTile label="velocity z" z={zV} />
        <ZTile label="accel z" z={zA} />
        <ZTile label="jerk z" z={zJ} />
      </div>

      <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${regime.className}`}>
        <div className="font-semibold">{regime.label}</div>
        <div className="text-xs opacity-80">{regime.detail}</div>
      </div>

      {latestSmoothed != null && (
        <div className="mt-2 text-xs text-muted">
          5d-smoothed level: {fmtNum(latestSmoothed, 1)}
        </div>
      )}
    </div>
  );
}

function ZTile({ label, z }: { label: string; z: number | null }) {
  const color = z == null ? "text-muted" : deltaColor(z);
  return (
    <div className="rounded-lg border border-border bg-bg/40 px-2 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 text-base font-semibold tabular-nums ${color}`}>
        {z == null ? "n/a" : fmtSignedNum(z)}
      </div>
    </div>
  );
}
