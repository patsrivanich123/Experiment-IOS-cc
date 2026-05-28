#!/usr/bin/env python3
"""XAU/USD (gold) monitor — plots smoothed price velocity and acceleration.

Velocity is the first time-derivative of price (momentum) and acceleration is
the second derivative (whether momentum is building or fading). Raw price
differences are far too noisy to be useful, so a Savitzky-Golay filter is used:
it fits a local polynomial over a sliding window and reads the derivatives off
that fit, which smooths and differentiates in a single, phase-preserving pass.
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

# Smoothing windows that suit each sampling interval. Roughly one trading
# "session" of bars so the derivatives reflect intraday/daily swings, not tick
# noise. savgol needs an odd window strictly greater than the polyorder.
INTERVAL_WINDOWS = {
    "1m": 31,
    "5m": 25,
    "15m": 21,
    "30m": 15,
    "60m": 15,
    "1h": 15,
    "1d": 11,
    "1wk": 7,
}


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


def adaptive_window(n_points: int, interval: str, override: int | None) -> int:
    """Pick a valid, odd savgol window for the data length and interval."""
    win = override if override else INTERVAL_WINDOWS.get(interval, 15)
    win = min(win, n_points if n_points % 2 == 1 else n_points - 1)
    if win % 2 == 0:
        win -= 1
    return max(win, 5)  # polyorder 2 needs at least 5 points


def compute_kinematics(
    price: pd.Series, window: int, polyorder: int = 2
) -> dict[str, np.ndarray]:
    """Smoothed price plus its velocity and acceleration (per-bar units)."""
    values = price.to_numpy(dtype=float)
    smoothed = savgol_filter(values, window, polyorder, deriv=0)
    velocity = savgol_filter(values, window, polyorder, deriv=1)
    acceleration = savgol_filter(values, window, polyorder, deriv=2)
    return {"smoothed": smoothed, "velocity": velocity, "acceleration": acceleration}


def plot(
    price: pd.Series,
    kin: dict[str, np.ndarray],
    symbol: str,
    interval: str,
    window: int,
    out_path: str,
) -> None:
    idx = price.index
    fig, (ax_p, ax_v, ax_a) = plt.subplots(
        3, 1, figsize=(13, 10), sharex=True, gridspec_kw={"hspace": 0.12}
    )
    fig.suptitle(
        f"XAU/USD Monitor — {symbol}  ({interval} bars, savgol window={window})",
        fontsize=14,
        fontweight="bold",
    )

    # Price: raw vs smoothed.
    ax_p.plot(idx, price.to_numpy(), color="#999", lw=0.8, label="Price (raw)")
    ax_p.plot(idx, kin["smoothed"], color="#d4af37", lw=1.8, label="Price (smoothed)")
    ax_p.set_ylabel("Price (USD/oz)")
    ax_p.legend(loc="upper left", fontsize=9)
    ax_p.grid(True, alpha=0.3)

    # Velocity: green up, red down.
    vel = kin["velocity"]
    ax_v.plot(idx, vel, color="#1f77b4", lw=1.4)
    ax_v.fill_between(idx, vel, 0, where=vel >= 0, color="#2ca02c", alpha=0.25)
    ax_v.fill_between(idx, vel, 0, where=vel < 0, color="#d62728", alpha=0.25)
    ax_v.axhline(0, color="black", lw=0.6)
    ax_v.set_ylabel("Velocity (USD/bar)")
    ax_v.grid(True, alpha=0.3)

    # Acceleration.
    acc = kin["acceleration"]
    ax_a.plot(idx, acc, color="#9467bd", lw=1.4)
    ax_a.fill_between(idx, acc, 0, where=acc >= 0, color="#2ca02c", alpha=0.25)
    ax_a.fill_between(idx, acc, 0, where=acc < 0, color="#d62728", alpha=0.25)
    ax_a.axhline(0, color="black", lw=0.6)
    ax_a.set_ylabel("Acceleration (USD/bar²)")
    ax_a.set_xlabel("Time")
    ax_a.grid(True, alpha=0.3)

    ax_a.xaxis.set_major_formatter(mdates.DateFormatter("%m-%d %H:%M"))
    fig.autofmt_xdate()
    fig.savefig(out_path, dpi=130, bbox_inches="tight")
    plt.close(fig)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="XAU/USD velocity & acceleration monitor.")
    p.add_argument("--symbol", default=None, help="Override ticker (default: GC=F gold future)")
    p.add_argument("--period", default="1mo", help="History window, e.g. 5d, 1mo, 6mo")
    p.add_argument("--interval", default="1h", help="Bar size, e.g. 5m, 1h, 1d")
    p.add_argument("--window", type=int, default=None, help="Savgol smoothing window (odd)")
    p.add_argument("--output", default="xauusd_monitor.png", help="Output PNG path")
    args = p.parse_args(argv)

    try:
        price, symbol = fetch_gold(args.symbol, args.period, args.interval)
    except RuntimeError as e:
        print(e, file=sys.stderr)
        return 1

    window = adaptive_window(len(price), args.interval, args.window)
    kin = compute_kinematics(price, window)
    plot(price, kin, symbol, args.interval, window, args.output)

    last_price = float(price.iloc[-1])
    last_vel = float(kin["velocity"][-1])
    last_acc = float(kin["acceleration"][-1])
    print(f"Symbol:        {symbol}")
    print(f"Bars:          {len(price)}  ({args.interval}, period={args.period})")
    print(f"Smooth window: {window}")
    print(f"Last price:    {last_price:,.2f} USD/oz")
    print(f"Velocity:      {last_vel:+.4f} USD/bar  ({'rising' if last_vel >= 0 else 'falling'})")
    print(f"Acceleration:  {last_acc:+.5f} USD/bar²  ({'building' if last_acc >= 0 else 'fading'})")
    print(f"Saved chart:   {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
