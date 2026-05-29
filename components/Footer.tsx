"use client";

import { useEffect, useState } from "react";

/**
 * Footer sits at the bottom of the dashboard, showing the time of the most
 * recent successful API call and source attributions. Polls a cheap endpoint
 * once on mount and again whenever the page becomes visible, so the timestamp
 * is honest if you leave the tab open.
 */
export function Footer() {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const ping = async (): Promise<void> => {
      try {
        const r = await fetch("/api/reer", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await r.json();
        if (cancelled) return;
        setLastRefresh(new Date());
        setRefreshError(null);
      } catch (e: unknown) {
        if (cancelled) return;
        setRefreshError(e instanceof Error ? e.message : "refresh failed");
      }
    };

    void ping();
    const onVisible = () => {
      if (document.visibilityState === "visible") void ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const ts = lastRefresh
    ? lastRefresh.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const live = lastRefresh != null && refreshError == null;

  return (
    <footer className="mt-10 border-t border-border-soft pt-5 text-[11.5px] text-muted-soft">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              live ? "bg-up" : "bg-down"
            }`}
            aria-hidden="true"
          />
          <span>
            {live ? "Live" : "Stale"} · last refresh{" "}
            <span className="font-mono text-text-dim">{ts}</span>
          </span>
        </div>
        {refreshError && (
          <span className="text-down">{refreshError}</span>
        )}
      </div>
      <div className="mt-3 leading-relaxed">
        These are <span className="text-text-dim">daily closing prices</span> —
        each source publishes the prior trading day&apos;s close some hours after
        markets close. There won&apos;t be a same-day data point until then.
      </div>
      <div className="mt-2 leading-relaxed">
        Data: USD/THB — Frankfurter (ECB) · DXY proxy / 10Y / Brent — FRED · Gold
        — currency-api via jsDelivr · REER — stub.
      </div>
      <div className="mt-1.5 text-muted-soft">Not investment advice.</div>
    </footer>
  );
}
