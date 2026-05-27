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
    <section className="rounded-2xl border border-border bg-panel p-4 shadow-sm">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted leading-snug">{subtitle}</p>
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
      className="animate-pulse rounded-md bg-border/40"
      style={{ height }}
      aria-hidden="true"
    />
  );
}

export function PanelError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
      Failed to load: {message}
    </div>
  );
}
