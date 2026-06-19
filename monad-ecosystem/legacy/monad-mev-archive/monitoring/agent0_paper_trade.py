#!/usr/bin/env python3
"""
Agent 0 paper-trade analyzer.

Builds a deterministic "would-have" ledger from logged execution plans and
market snapshots.

Expected input:
- feedback-*.jsonl files produced by model-feedback-logger
- execution.execution-plan events included in INPUT_TOPICS

Markout model per plan:
1. Hypothetically buy on entry venue at entryPrice and short on exit venue at exitPrice.
2. Mark both legs to mid-price at horizon H.
3. Compute PnL on plan size.
"""

from __future__ import annotations

import argparse
import bisect
import csv
import json
import math
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

SNAPSHOT_EVENT_TYPES = {
    "market.base.price-snapshot",
    "market.arbitrum.price-snapshot",
    "market.monad.price-snapshot",
    "market.eth.price-snapshot",
}

PLAN_EVENT_TYPE = "execution.execution-plan"


@dataclass(frozen=True)
class PlanRecord:
    plan_id: str
    timestamp_ms: int
    direction: str
    mode: str
    entry_venue: str
    exit_venue: str
    entry_price: float
    exit_price: float
    size_usd: float
    expected_ev: float
    approved: bool


@dataclass
class PriceSeries:
    times: List[int]
    prices: List[float]

    def at_or_after(self, target_ms: int) -> Optional[Tuple[int, float]]:
        idx = bisect.bisect_left(self.times, target_ms)
        if idx >= len(self.times):
            return None
        return self.times[idx], self.prices[idx]


def parse_float(value: Any) -> Optional[float]:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(parsed):
        return None
    return parsed


def extract_timestamp_ms(event: Dict[str, Any], data: Dict[str, Any]) -> Optional[int]:
    meta = data.get("meta")
    if isinstance(meta, dict):
        ts = parse_float(meta.get("timestampMs"))
        if ts is not None:
            return int(ts)
    event_ts = parse_float(event.get("timestampMs"))
    if event_ts is not None:
        return int(event_ts)
    return None


def iter_feedback_events(logs_dir: Path) -> Iterable[Dict[str, Any]]:
    for path in sorted(logs_dir.glob("feedback-*.jsonl")):
        with path.open("r", encoding="utf-8") as handle:
            for raw in handle:
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if isinstance(payload, dict):
                    yield payload


def build_snapshot_index(events: Iterable[Dict[str, Any]]) -> Dict[str, PriceSeries]:
    buckets: Dict[str, List[Tuple[int, float]]] = {}
    for event in events:
        if event.get("eventType") not in SNAPSHOT_EVENT_TYPES:
            continue
        data = event.get("data")
        if not isinstance(data, dict):
            continue

        market_id = data.get("marketId")
        if not isinstance(market_id, str) or not market_id:
            continue

        price = parse_float(data.get("priceMid"))
        if price is None:
            continue

        ts = extract_timestamp_ms(event, data)
        if ts is None:
            continue

        buckets.setdefault(market_id, []).append((ts, price))

    series: Dict[str, PriceSeries] = {}
    for market_id, entries in buckets.items():
        entries.sort(key=lambda item: item[0])
        times = [item[0] for item in entries]
        prices = [item[1] for item in entries]
        series[market_id] = PriceSeries(times=times, prices=prices)
    return series


def extract_plans(
    events: Iterable[Dict[str, Any]],
    include_unapproved: bool,
) -> List[PlanRecord]:
    plans: List[PlanRecord] = []
    for event in events:
        if event.get("eventType") != PLAN_EVENT_TYPE:
            continue
        data = event.get("data")
        if not isinstance(data, dict):
            continue

        approved = bool(data.get("approved", False))
        if not include_unapproved and not approved:
            continue

        plan_id = data.get("planId")
        entry_venue = data.get("entryVenue")
        exit_venue = data.get("exitVenue")
        direction = data.get("direction")
        mode = data.get("mode")
        if not all(isinstance(v, str) and v for v in [plan_id, entry_venue, exit_venue, direction, mode]):
            continue

        entry_price = parse_float(data.get("entryPrice"))
        exit_price = parse_float(data.get("exitPrice"))
        size_usd = parse_float(data.get("size"))
        expected_ev = parse_float(data.get("expectedEv"))
        ts = extract_timestamp_ms(event, data)
        if (
            entry_price is None
            or exit_price is None
            or size_usd is None
            or expected_ev is None
            or ts is None
        ):
            continue
        if entry_price <= 0 or size_usd <= 0:
            continue

        plans.append(
            PlanRecord(
                plan_id=plan_id,
                timestamp_ms=ts,
                direction=direction,
                mode=mode,
                entry_venue=entry_venue,
                exit_venue=exit_venue,
                entry_price=entry_price,
                exit_price=exit_price,
                size_usd=size_usd,
                expected_ev=expected_ev,
                approved=approved,
            )
        )

    plans.sort(key=lambda plan: plan.timestamp_ms)
    return plans


def compute_markouts(
    plans: Sequence[PlanRecord],
    snapshots: Dict[str, PriceSeries],
    horizons_sec: Sequence[int],
    max_sample_lag_ms: int,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for plan in plans:
        entry_series = snapshots.get(plan.entry_venue)
        exit_series = snapshots.get(plan.exit_venue)
        if entry_series is None or exit_series is None:
            continue

        qty = plan.size_usd / plan.entry_price

        for horizon_sec in horizons_sec:
            target_ms = plan.timestamp_ms + (horizon_sec * 1000)
            entry_future = entry_series.at_or_after(target_ms)
            exit_future = exit_series.at_or_after(target_ms)
            if entry_future is None or exit_future is None:
                continue

            entry_sample_ts, entry_future_price = entry_future
            exit_sample_ts, exit_future_price = exit_future
            sample_lag_ms = max(entry_sample_ts - target_ms, exit_sample_ts - target_ms)
            if sample_lag_ms > max_sample_lag_ms:
                continue

            # Hypothetical two-leg unwind:
            #   PnL = (entry_future - entry_open) + (exit_open - exit_future), scaled by quantity.
            unit_pnl = (entry_future_price - plan.entry_price) + (plan.exit_price - exit_future_price)
            markout_pnl_usd = qty * unit_pnl
            markout_bps = (markout_pnl_usd / plan.size_usd) * 10000

            edge_open = plan.exit_price - plan.entry_price
            edge_close = exit_future_price - entry_future_price

            rows.append(
                {
                    "plan_id": plan.plan_id,
                    "timestamp_ms": plan.timestamp_ms,
                    "direction": plan.direction,
                    "mode": plan.mode,
                    "entry_venue": plan.entry_venue,
                    "exit_venue": plan.exit_venue,
                    "approved": plan.approved,
                    "horizon_sec": horizon_sec,
                    "size_usd": round(plan.size_usd, 6),
                    "expected_ev_usd": round(plan.expected_ev, 6),
                    "entry_price": round(plan.entry_price, 8),
                    "exit_price": round(plan.exit_price, 8),
                    "future_entry_price": round(entry_future_price, 8),
                    "future_exit_price": round(exit_future_price, 8),
                    "sample_lag_ms": int(sample_lag_ms),
                    "edge_open": round(edge_open, 8),
                    "edge_close": round(edge_close, 8),
                    "edge_delta": round(edge_close - edge_open, 8),
                    "markout_pnl_usd": round(markout_pnl_usd, 8),
                    "markout_bps": round(markout_bps, 8),
                }
            )
    return rows


def summarize_markouts(rows: Sequence[Dict[str, Any]], plans_seen: int) -> Dict[str, Any]:
    horizon_buckets: Dict[int, List[Dict[str, Any]]] = {}
    sampled_plan_ids = set()
    for row in rows:
        sampled_plan_ids.add(row["plan_id"])
        horizon_buckets.setdefault(int(row["horizon_sec"]), []).append(row)

    horizon_stats: Dict[str, Dict[str, Any]] = {}
    for horizon_sec, bucket in sorted(horizon_buckets.items()):
        pnls = [float(row["markout_pnl_usd"]) for row in bucket]
        bps = [float(row["markout_bps"]) for row in bucket]
        wins = [value for value in pnls if value > 0]
        losses = [value for value in pnls if value <= 0]
        horizon_stats[str(horizon_sec)] = {
            "samples": len(bucket),
            "unique_plans": len({row["plan_id"] for row in bucket}),
            "win_rate": round((len(wins) / len(bucket)) if bucket else 0.0, 6),
            "avg_pnl_usd": round(statistics.mean(pnls), 8) if pnls else 0.0,
            "median_pnl_usd": round(statistics.median(pnls), 8) if pnls else 0.0,
            "avg_markout_bps": round(statistics.mean(bps), 8) if bps else 0.0,
            "avg_loss_usd": round(statistics.mean(losses), 8) if losses else 0.0,
            "worst_loss_usd": round(min(losses), 8) if losses else 0.0,
        }

    return {
        "plans_seen": plans_seen,
        "plans_with_samples": len(sampled_plan_ids),
        "sample_coverage": round((len(sampled_plan_ids) / plans_seen), 6) if plans_seen else 0.0,
        "total_samples": len(rows),
        "horizon_stats": horizon_stats,
    }


def write_csv(path: Path, rows: Sequence[Dict[str, Any]]) -> None:
    if not rows:
        headers = [
            "plan_id",
            "timestamp_ms",
            "direction",
            "mode",
            "entry_venue",
            "exit_venue",
            "approved",
            "horizon_sec",
            "size_usd",
            "expected_ev_usd",
            "entry_price",
            "exit_price",
            "future_entry_price",
            "future_exit_price",
            "sample_lag_ms",
            "edge_open",
            "edge_close",
            "edge_delta",
            "markout_pnl_usd",
            "markout_bps",
        ]
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=headers)
            writer.writeheader()
        return

    headers = list(rows[0].keys())
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def parse_horizons(raw: str) -> List[int]:
    values: List[int] = []
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        value = int(token)
        if value <= 0:
            continue
        values.append(value)
    deduped = sorted(set(values))
    if not deduped:
        raise ValueError("No valid horizons provided")
    return deduped


def main() -> int:
    parser = argparse.ArgumentParser(description="Agent 0 paper-trade analyzer")
    parser.add_argument(
        "--logs-dir",
        type=Path,
        default=Path("./logs"),
        help="Directory containing feedback-*.jsonl files",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory for report files (default: logs-dir)",
    )
    parser.add_argument(
        "--output-prefix",
        type=str,
        default="agent0-paper",
        help="Prefix for output files",
    )
    parser.add_argument(
        "--horizons-sec",
        type=str,
        default="60,300,900,3600",
        help="Comma-separated horizon seconds",
    )
    parser.add_argument(
        "--max-sample-lag-sec",
        type=int,
        default=120,
        help="Max allowed lag between target horizon and sampled price",
    )
    parser.add_argument(
        "--include-unapproved",
        action="store_true",
        help="Include non-approved plans in analysis",
    )
    args = parser.parse_args()

    logs_dir = args.logs_dir
    if not logs_dir.exists():
        raise FileNotFoundError(f"Logs directory not found: {logs_dir}")

    output_dir = args.output_dir or logs_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    horizons = parse_horizons(args.horizons_sec)
    max_sample_lag_ms = args.max_sample_lag_sec * 1000

    events = list(iter_feedback_events(logs_dir))
    snapshots = build_snapshot_index(events)
    plans = extract_plans(events, include_unapproved=args.include_unapproved)
    rows = compute_markouts(plans, snapshots, horizons, max_sample_lag_ms)
    summary = summarize_markouts(rows, plans_seen=len(plans))

    csv_path = output_dir / f"{args.output_prefix}-trades.csv"
    json_path = output_dir / f"{args.output_prefix}-summary.json"
    write_csv(csv_path, rows)
    json_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"Events loaded: {len(events)}")
    print(f"Markets indexed: {len(snapshots)}")
    print(f"Plans analyzed: {len(plans)}")
    print(f"Samples generated: {len(rows)}")
    print(f"CSV report: {csv_path}")
    print(f"Summary report: {json_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
