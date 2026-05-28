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
    <Panel
      title="USD/THB"
      subtitle="Spot and recent change. ↑ = baht weakening."
    >
      {error && <PanelError message={error} />}
      {!error && !data && <PanelSkeleton height={120} />}
      {!error && data && <Tiles series={data.usdThb} />}
    </Panel>
  );
}

function Tiles({ series }: { series: DailyPoint[] }) {
  const c = computeChanges(series);
  if (!c) return <PanelError message="not enough data" />;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="text-3xl font-semibold tabular-nums">{fmtNum(c.spot, 4)}</div>
        <div className={`text-sm font-medium tabular-nums ${deltaColor(c.d1)}`}>
          {fmtPct(c.d1)} <span className="text-muted font-normal">1d</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Tile label="5d" value={c.d5} />
        <Tile label="30d" value={c.d30} />
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg/40 px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-0.5 text-base font-semibold tabular-nums ${deltaColor(value)}`}>
        {fmtPct(value)}
      </div>
    </div>
  );
}
