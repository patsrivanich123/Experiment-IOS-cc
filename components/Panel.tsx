/**
 * Card-like container shared by all dashboard panels. Tailwind only.
 */

import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
};

export function Panel({ title, subtitle, right, children }: PanelProps) {
  return (
    <section
      className="
        relative overflow-hidden rounded-[28px] border border-border-soft
        bg-gradient-to-b from-panel-2 to-panel
        p-5 shadow-card
      "
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold leading-tight text-text">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-[12.5px] leading-snug text-muted">
              {subtitle}
            </p>
          )}
        </div>
        {right && <div className="shrink-0 text-right">{right}</div>}
      </header>
      {children}
    </section>
  );
}

export function PanelSkeleton({ height = 160 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-2xl bg-border/30"
      style={{ height }}
      aria-hidden="true"
    />
  );
}

export function PanelError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-down/30 bg-down-soft px-3.5 py-2.5 text-[13px] text-down">
      <span className="font-medium">Failed to load:</span> {message}
    </div>
  );
}
