"use client";

import { useState } from "react";

/**
 * Header bar with the project lockup + a manual refresh button.
 *
 * The button does a full page reload — simplest correct behavior given the
 * panels each `useEffect(..., [])` to fetch on mount. Cheap on this app
 * (one HTML + four small JSON calls) and matches what users would do with
 * pull-to-refresh anyway.
 */
export function HeaderBar() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    window.location.reload();
  };

  return (
    <header className="mb-7 flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-violet/20 ring-1 ring-accent/30">
            <span className="text-[15px] font-semibold leading-none text-accent">
              ฿
            </span>
          </div>
          <h1 className="text-[20px] font-semibold leading-none tracking-tight">
            THB Dashboard
          </h1>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-soft">
          Macro signals for the Thai baht. Daily closes from public sources.
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh data"
        className="
          mt-0.5 flex h-9 w-9 items-center justify-center rounded-full
          border border-border-soft bg-panel-2 text-muted
          transition active:scale-95 hover:text-text hover:border-border
          disabled:opacity-50
        "
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={refreshing ? "animate-spin" : ""}
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
      </button>
    </header>
  );
}
