"use client";

import { useEffect, useState } from "react";
import type { DailyPoint } from "@/lib/fetchers";
import type { FxResponse } from "@/app/api/fx/route";
import { Panel, PanelSkeleton, PanelError } from "./Panel";
import { deltaColor, fmtNum, fmtPct } from "@/lib/format";

type ChangeSet = {
  spot: number;
  d1: number;
  d5: number;
  d30: number;
};

function computeChanges(series: DailyPoint[]): ChangeSet | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1].close;
  const at = (offsetFromEnd: number): number | null => {
    const i = series.length - 1 - offsetFromEnd;
    return i >= 0 ? series[i].close : null;
  };
  const prev1 = at(1);
  const prev5 = at(5);
  const prev30 = at(30);

  return {
    spot: last,
    d1: prev1 != null ? (last - prev1) / prev1 : 0,
    d5: prev5 != null ? (last - prev5) / prev5 : 0,
    d30: prev30 != null ? (last - prev30) / prev30 : 0,
  };
}

export function HeadlineTiles() {
  const [data, setData] = useState<FxResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/fx?range=3mo")
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return (await r.json()) as FxResponse;
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
    <Panel title="USD / THB" subtitle="Spot rate · ↑ = baht weakening">
      {error && <PanelError message={error} />}
      {!error && !data && <PanelSkeleton height={160} />}
      {!error && data && <Tiles series={data.usdThb} />}
    </Panel>
  );
}

function Tiles({ series }: { series: DailyPoint[] }) {
  const c = computeChanges(series);
  if (!c) return <PanelError message="not enough data" />;

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[64px] font-semibold leading-none tracking-tightest text-text">
            {fmtNum(c.spot, 3)}
          </div>
          <div className="mt-2 text-[11px] uppercase tracking-wider text-muted-soft">
            Thai Baht per US Dollar
          </div>
        </div>
        <Chip value={c.d1} label="1d" big />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Tile label="5d" value={c.d5} />
        <Tile label="30d" value={c.d30} />
      </div>
    </div>
  );
}

function Chip({ value, label, big }: { value: number; label: string; big?: boolean }) {
  const positive = value > 0;
  const negative = value < 0;
  const bg = positive ? "bg-up-soft" : negative ? "bg-down-soft" : "bg-border/40";
  const color = positive ? "text-up" : negative ? "text-down" : "text-muted";
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${bg} ${color} ${
        big ? "text-[13px] font-medium" : "text-[12px]"
      }`}
    >
      <Arrow direction={positive ? "up" : negative ? "down" : "flat"} />
      <span className="font-mono tabular-nums">{fmtPct(value)}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-bg/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-soft">
          {label}
        </div>
        <Arrow direction={value > 0 ? "up" : value < 0 ? "down" : "flat"} small />
      </div>
      <div
        className={`mt-1 font-mono text-[20px] font-semibold tabular-nums leading-none ${deltaColor(
          value,
        )}`}
      >
        {fmtPct(value)}
      </div>
    </div>
  );
}

function Arrow({ direction, small }: { direction: "up" | "down" | "flat"; small?: boolean }) {
  if (direction === "flat") return null;
  const size = small ? 10 : 12;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden="true"
    >
      {direction === "up" ? (
        <path d="M5 1l4 5H6v3H4V6H1z" />
      ) : (
        <path d="M5 9L1 4h3V1h2v3h3z" />
      )}
    </svg>
  );
}
