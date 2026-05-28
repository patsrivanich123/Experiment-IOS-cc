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
from matplotlib.collections import LineCollection

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


def plot_phase(
    price: pd.Series,
    kin: dict[str, np.ndarray],
    symbol: str,
    smooth_days: int,
    out_path: str,
) -> None:
    """Phase portrait: velocity (x) vs acceleration (y), traced through time.

    The four quadrants describe the trend's state:
      Q1  v>0, a>0  rising & accelerating   -> uptrend strengthening
      Q2  v<0, a>0  falling & decelerating   -> downtrend bottoming
      Q3  v<0, a<0  falling & accelerating   -> downtrend strengthening
      Q4  v>0, a<0  rising & decelerating     -> uptrend topping
    """
    v = kin["velocity"]
    a = kin["acceleration"]
    t = np.arange(len(v))

    fig, ax = plt.subplots(figsize=(10, 9))
    fig.suptitle(
        f"XAU/USD Phase Portrait — {symbol}  ({smooth_days}-day smoothing)",
        fontsize=14,
        fontweight="bold",
    )

    # Time-coloured trajectory (old = dark, recent = bright).
    pts = np.array([v, a]).T.reshape(-1, 1, 2)
    segments = np.concatenate([pts[:-1], pts[1:]], axis=1)
    lc = LineCollection(segments, cmap="viridis", linewidth=1.6, alpha=0.9)
    lc.set_array(t[:-1])
    ax.add_collection(lc)
    ax.scatter(v, a, c=t, cmap="viridis", s=12, zorder=3)

    # Start and current markers.
    ax.scatter(v[0], a[0], color="white", edgecolor="black", s=90, zorder=4)
    ax.annotate("start", (v[0], a[0]), textcoords="offset points", xytext=(8, 6))
    ax.scatter(v[-1], a[-1], color="red", edgecolor="black", s=130, zorder=5)
    ax.annotate(
        f"now\n{price.index[-1].date()}",
        (v[-1], a[-1]),
        textcoords="offset points",
        xytext=(8, 8),
        fontweight="bold",
    )

    # Quadrant axes, symmetric limits so the origin sits at centre.
    vmax = np.nanmax(np.abs(v)) * 1.15 or 1.0
    amax = np.nanmax(np.abs(a)) * 1.15 or 1.0
    ax.set_xlim(-vmax, vmax)
    ax.set_ylim(-amax, amax)
    ax.axhline(0, color="black", lw=0.8)
    ax.axvline(0, color="black", lw=0.8)

    labels = {
        (0.97, 0.97): ("Rising & accelerating", "right", "top", "#2ca02c"),
        (0.03, 0.97): ("Falling, decelerating", "left", "top", "#8c6d1f"),
        (0.03, 0.03): ("Falling & accelerating", "left", "bottom", "#d62728"),
        (0.97, 0.03): ("Rising, decelerating", "right", "bottom", "#8c6d1f"),
    }
    for (fx, fy), (text, ha, va, color) in labels.items():
        ax.text(
            fx, fy, text, transform=ax.transAxes, ha=ha, va=va,
            fontsize=10, color=color, fontweight="bold", alpha=0.8,
        )

    ax.set_xlabel("Velocity (USD/day)  —  momentum")
    ax.set_ylabel("Acceleration (USD/day²)  —  change in momentum")
    ax.grid(True, alpha=0.25)

    # Colourbar mapped to dates.
    cbar = fig.colorbar(lc, ax=ax, pad=0.02)
    n = len(price)
    ticks = np.linspace(0, n - 2, min(6, n - 1)).astype(int)
    cbar.set_ticks(ticks)
    cbar.set_ticklabels([str(price.index[i].date()) for i in ticks])
    cbar.set_label("Date")

    fig.savefig(out_path, dpi=130, bbox_inches="tight")
    plt.close(fig)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="XAU/USD velocity & acceleration monitor.")
    p.add_argument("--symbol", default=None, help="Override ticker (default: GC=F gold future)")
    p.add_argument("--period", default="6mo", help="History window, e.g. 3mo, 6mo, 1y")
    p.add_argument("--interval", default="1d", help="Bar size, e.g. 1h, 1d, 1wk")
    p.add_argument(
        "--mode",
        choices=["phase", "panels", "both"],
        default="phase",
        help="phase = velocity-vs-acceleration portrait, panels = time series",
    )
    p.add_argument(
        "--smooth-days",
        type=int,
        nargs="+",
        default=DEFAULT_SMOOTH_DAYS,
        metavar="D",
        help="Smoothing horizon(s) in trading days for panels mode (default: 5 20)",
    )
    p.add_argument(
        "--phase-days",
        type=int,
        default=10,
        help="Single smoothing horizon for the phase portrait (default: 10)",
    )
    p.add_argument("--output", default="xauusd_monitor.png", help="Output PNG path")
    args = p.parse_args(argv)

    try:
        price, symbol = fetch_gold(args.symbol, args.period, args.interval)
    except RuntimeError as e:
        print(e, file=sys.stderr)
        return 1

    per_day = bars_per_day(price)
    print(f"Symbol:        {symbol}")
    print(f"Bars:          {len(price)}  ({args.interval}, period={args.period})")
    print(f"Bars/day:      {per_day:.1f}")
    print(f"Last price:    {float(price.iloc[-1]):,.2f} USD/oz")

    if args.mode in ("panels", "both"):
        series: dict[int, dict[str, np.ndarray]] = {}
        for days in sorted(set(args.smooth_days)):
            window = day_window(days, per_day, len(price))
            series[days] = compute_kinematics(price, window, per_day)
        out = args.output if args.mode == "panels" else _suffix(args.output, "panels")
        plot(price, series, symbol, args.interval, out)
        for days, kin in series.items():
            window = day_window(days, per_day, len(price))
            vel, acc = float(kin["velocity"][-1]), float(kin["acceleration"][-1])
            print(
                f"  {days:>3}-day (win={window:>3}): "
                f"vel {vel:+8.2f} USD/day ({'rising' if vel >= 0 else 'falling'}), "
                f"acc {acc:+8.3f} USD/day² ({'building' if acc >= 0 else 'fading'})"
            )
        print(f"Saved panels:  {out}")

    if args.mode in ("phase", "both"):
        window = day_window(args.phase_days, per_day, len(price))
        kin = compute_kinematics(price, window, per_day)
        out = args.output if args.mode == "phase" else _suffix(args.output, "phase")
        plot_phase(price, kin, symbol, args.phase_days, out)
        vel, acc = float(kin["velocity"][-1]), float(kin["acceleration"][-1])
        print(f"Phase ({args.phase_days}-day, win={window}): now in {_quadrant(vel, acc)}")
        print(f"Saved phase:   {out}")

    return 0


def _suffix(path: str, tag: str) -> str:
    if path.endswith(".png"):
        return f"{path[:-4]}_{tag}.png"
    return f"{path}_{tag}"


def _quadrant(v: float, a: float) -> str:
    if v >= 0 and a >= 0:
        return "Q1 rising & accelerating (uptrend strengthening)"
    if v < 0 <= a:
        return "Q2 falling but decelerating (downtrend bottoming)"
    if v < 0 and a < 0:
        return "Q3 falling & accelerating (downtrend strengthening)"
    return "Q4 rising but decelerating (uptrend topping)"


if __name__ == "__main__":
    raise SystemExit(main())
