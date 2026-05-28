#!/usr/bin/env python3
"""XAU/USD (gold) monitor — smoothed price velocity and acceleration.

Velocity is the first time-derivative of price (momentum) and acceleration is
the second derivative (whether momentum is building or fading). Raw price
differences are far too noisy, so a Savitzky-Golay filter is used: it fits a
local polynomial over a sliding window and reads the derivatives off that fit,
smoothing and differentiating in one phase-preserving pass.

Smoothing is specified in *trading days* (e.g. 5-day short-term, 20-day
medium-term — the classic MA lookbacks) rather than raw bar counts, and the
derivatives are reported in per-day units so they read the same regardless of
the bar interval.
"""

from __future__ import annotations

import argparse
import sys
import warnings

import numpy as np
import pandas as pd
from scipy.signal import savgol_filter

import matplotlib

matplotlib.use("Agg")  # headless-safe; never needs a display
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

warnings.filterwarnings("ignore")

# Yahoo has no spot XAUUSD feed; GC=F (COMEX gold future) tracks it closely.
GOLD_SYMBOLS = ["GC=F", "GLD"]

# Default smoothing horizons in trading days: short-term and medium-term.
DEFAULT_SMOOTH_DAYS = [5, 20]

# Distinct colours for each smoothing horizon.
PERIOD_COLORS = ["#1f77b4", "#d4af37", "#9467bd", "#e377c2", "#17becf"]


def fetch_gold(symbol: str | None, period: str, interval: str) -> tuple[pd.Series, str]:
    """Return a clean close-price series and the symbol actually used."""
    import yfinance as yf

    candidates = [symbol] if symbol else GOLD_SYMBOLS
    last_err: Exception | None = None
    for sym in candidates:
        try:
            df = yf.download(
                sym, period=period, interval=interval, progress=False, auto_adjust=True
            )
        except Exception as e:  # network / symbol errors
            last_err = e
            continue
        if df is None or df.empty:
            continue
        close = df["Close"]
        if isinstance(close, pd.DataFrame):  # yfinance MultiIndex columns
            close = close.iloc[:, 0]
        close = close.dropna()
        if len(close) >= 5:
            return close, sym
    raise RuntimeError(
        f"Could not fetch gold data for {candidates} (period={period}, "
        f"interval={interval}). Last error: {last_err}"
    )


def bars_per_day(price: pd.Series) -> float:
    """Median number of bars per trading day, inferred from the timestamps."""
    counts = price.groupby(price.index.normalize()).size()
    counts = counts[counts > 0]
    return float(counts.median()) if len(counts) else 1.0


def day_window(days: int, per_day: float, n_points: int) -> int:
    """Convert a trading-day horizon into a valid odd savgol window."""
    win = int(round(days * per_day))
    win = min(win, n_points if n_points % 2 == 1 else n_points - 1)
    if win % 2 == 0:
        win += 1  # savgol needs an odd window
    win = min(win, n_points - 1 if n_points % 2 == 0 else n_points)
    return max(win, 5)  # polyorder 2 needs at least 5 points


def compute_kinematics(
    price: pd.Series, window: int, per_day: float, polyorder: int = 2
) -> dict[str, np.ndarray]:
    """Smoothed price plus velocity (USD/day) and acceleration (USD/day²)."""
    values = price.to_numpy(dtype=float)
    smoothed = savgol_filter(values, window, polyorder, deriv=0)
    # savgol derivatives are per-bar; scale by bars/day to get per-day units.
    velocity = savgol_filter(values, window, polyorder, deriv=1) * per_day
    acceleration = savgol_filter(values, window, polyorder, deriv=2) * per_day**2
    return {"smoothed": smoothed, "velocity": velocity, "acceleration": acceleration}


def plot(
    price: pd.Series,
    series: dict[int, dict[str, np.ndarray]],
    symbol: str,
    interval: str,
    out_path: str,
) -> None:
    idx = price.index
    fig, (ax_p, ax_v, ax_a) = plt.subplots(
        3, 1, figsize=(13, 10), sharex=True, gridspec_kw={"hspace": 0.12}
    )
    fig.suptitle(
        f"XAU/USD Monitor — {symbol}  ({interval} bars)", fontsize=14, fontweight="bold"
    )

    ax_p.plot(idx, price.to_numpy(), color="#bbb", lw=0.8, label="Price (raw)")
    for i, (days, kin) in enumerate(series.items()):
        c = PERIOD_COLORS[i % len(PERIOD_COLORS)]
        ax_p.plot(idx, kin["smoothed"], color=c, lw=1.6, label=f"{days}-day smoothed")
        ax_v.plot(idx, kin["velocity"], color=c, lw=1.4, label=f"{days}-day")
        ax_a.plot(idx, kin["acceleration"], color=c, lw=1.4, label=f"{days}-day")

    ax_p.set_ylabel("Price (USD/oz)")
    ax_p.legend(loc="upper left", fontsize=9)
    ax_p.grid(True, alpha=0.3)

    ax_v.axhline(0, color="black", lw=0.6)
    ax_v.set_ylabel("Velocity (USD/day)")
    ax_v.legend(loc="upper left", fontsize=9)
    ax_v.grid(True, alpha=0.3)

    ax_a.axhline(0, color="black", lw=0.6)
    ax_a.set_ylabel("Acceleration (USD/day²)")
    ax_a.set_xlabel("Time")
    ax_a.legend(loc="upper left", fontsize=9)
    ax_a.grid(True, alpha=0.3)

    intraday = bars_per_day(price) > 1.5
    fmt = "%m-%d %H:%M" if intraday else "%Y-%m-%d"
    ax_a.xaxis.set_major_formatter(mdates.DateFormatter(fmt))
    fig.autofmt_xdate()
    fig.savefig(out_path, dpi=130, bbox_inches="tight")
    plt.close(fig)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="XAU/USD velocity & acceleration monitor.")
    p.add_argument("--symbol", default=None, help="Override ticker (default: GC=F gold future)")
    p.add_argument("--period", default="1y", help="History window, e.g. 6mo, 1y, 2y")
    p.add_argument("--interval", default="1d", help="Bar size, e.g. 1h, 1d, 1wk")
    p.add_argument(
        "--smooth-days",
        type=int,
        nargs="+",
        default=DEFAULT_SMOOTH_DAYS,
        metavar="D",
        help="Smoothing horizon(s) in trading days (default: 5 20)",
    )
    p.add_argument("--output", default="xauusd_monitor.png", help="Output PNG path")
    args = p.parse_args(argv)

    try:
        price, symbol = fetch_gold(args.symbol, args.period, args.interval)
    except RuntimeError as e:
        print(e, file=sys.stderr)
        return 1

    per_day = bars_per_day(price)
    series: dict[int, dict[str, np.ndarray]] = {}
    for days in sorted(set(args.smooth_days)):
        window = day_window(days, per_day, len(price))
        series[days] = compute_kinematics(price, window, per_day)

    plot(price, series, symbol, args.interval, args.output)

    print(f"Symbol:        {symbol}")
    print(f"Bars:          {len(price)}  ({args.interval}, period={args.period})")
    print(f"Bars/day:      {per_day:.1f}")
    print(f"Last price:    {float(price.iloc[-1]):,.2f} USD/oz")
    for days, kin in series.items():
        window = day_window(days, per_day, len(price))
        vel, acc = float(kin["velocity"][-1]), float(kin["acceleration"][-1])
        print(
            f"  {days:>3}-day (win={window:>3}): "
            f"vel {vel:+8.2f} USD/day ({'rising' if vel >= 0 else 'falling'}), "
            f"acc {acc:+8.3f} USD/day² ({'building' if acc >= 0 else 'fading'})"
        )
    print(f"Saved chart:   {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
