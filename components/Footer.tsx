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
        // /api/reer is server-rendered and effectively free — good heartbeat.
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
        second: "2-digit",
      })
    : "—";

  return (
    <footer className="mt-8 border-t border-border pt-4 text-xs text-muted">
      <div className="flex items-baseline justify-between gap-2">
        <span>
          Last refresh:{" "}
          <span className="font-mono text-text">{ts}</span>
          {refreshError && (
            <span className="ml-2 text-down">({refreshError})</span>
          )}
        </span>
      </div>
      <div className="mt-2 leading-relaxed">
        Sources: spot/FX, gold, US 10Y, Brent — Yahoo Finance (unofficial). REER
        — stub data, BIS integration in v1.1. Not investment advice.
      </div>
    </footer>
  );
}
