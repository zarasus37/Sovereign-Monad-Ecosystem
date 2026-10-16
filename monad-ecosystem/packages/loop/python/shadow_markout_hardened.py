"""
shadow_markout_hardened.py
Agent 0 — Shadow-Paper Markout Analyzer (Hardened)

PROVENANCE
----------
Ported 2026-10-16 into @sovereign/loop from the frozen workspace snapshot at
    archive/legacy-workspaces/monad-mev-legacy-2026-06/scripts/
    shadow_markout_hardened.py
    sha256:95391b2b05e8d34ed546bb998af264d4f270b2b626868566c22c2b1058d9d6de
Companion price fetcher (not ported; external repo remains its home):
    archive/legacy-workspaces/monad-mev-legacy-2026-06/scripts/monad_price_fetcher.py
    sha256:dacb94e46ce0b51539a0c2bb0e6fc12cb75d9398408e2bcbacc6ed5e69213f04

The live upstream copy lives at C:\\Users\\crisc\\Dev\\agents\\monad-mev\\ which
is OUTSIDE the agent sandbox. The 2026-06 snapshot above was the available
source (operator-confirmed 2026-10-16). If the live file has drifted since
2026-06, re-diff against the pinned sha256 before trusting production verdicts.

ROLE
----
This is the POST-FILL measurement harness. It is NOT the pre-trade gate.

It waits for T+15s and T+60s realized prices, accumulates trades, and reports
whether predicted alpha actually retained. The pre-trade gate the TS engine
calls synchronously (2s timeout) is shadow_markout_gate.py, which shares this
module's retention doctrine (gate_threshold, adverse-selection band, capacity
ceiling) but derives them from pre-trade observables only.

WHAT "HARDENED" MEANS HERE
-------------------------
Replaces the synthetic 0.95/0.90 multipliers with:
  - Async price fetch hooks wired to your Monad RPC connection
  - Per-trade disk persistence (JSON + CSV)
  - Corrected slippage_bps formula (ratio-based, not dollar-based)
  - Per-trade retention distribution analysis
  - Adverse selection flag per trade
  - Capacity ceiling calculation

DROP-IN BEHAVIOR CHANGE vs the upstream snapshot
------------------------------------------------
When the price fetcher is unavailable, the snapshot silently multiplied
predicted PnL by fallback_slippage_t15/t60 (0.95/0.90) — the exact synthetic
multiplier this file was written to eliminate, re-entering through the back
door. This port records the degradation instead of hiding it:
  - TradeRecord.price_source is 'rpc' | 'fallback'
  - MarkoutSummary.fallback_trade_count / fallback_rate are reported
  - gate_pure is False whenever any trade degraded
A trade set with gate_pure=False must not be read as evidence that the alpha
retained; it is evidence that the RPC hook was not wired.
"""

import json
import csv
import logging
import time
import asyncio
import hashlib
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Callable, Awaitable
from pathlib import Path
from statistics import mean, stdev

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

SOURCE_SHA256 = "95391b2b05e8d34ed546bb998af264d4f270b2b626868566c22c2b1058d9d6de"

# Retention doctrine. GATE_THRESHOLD is the fraction of predicted PnL that must
# actually materialize at T+15s for a trade to count as having retained its
# alpha. This module owns the doctrine; shadow_markout_gate.py borrows it.
GATE_THRESHOLD = 0.80

# Retention below this fraction of predicted PnL means the fill was against
# informed flow rather than passive liquidity.
ADVERSE_SELECTION_RETENTION = 0.70


# ---------------------------------------------------------------------------
# Data Structures
# ---------------------------------------------------------------------------

@dataclass
class TradeRecord:
    id: str
    predicted_pnl: float
    entry_price: float
    entry_timestamp: float

    # Populated after T+15s / T+60s price reads
    actual_pnl_t15: Optional[float] = None
    actual_pnl_t60: Optional[float] = None
    price_t15: Optional[float] = None
    price_t60: Optional[float] = None

    # Which side of the fallback boundary this trade landed on. 'rpc' means a
    # real price read; 'fallback' means predicted_pnl was scaled by a synthetic
    # multiplier because no price was available.
    price_source_t15: str = "rpc"
    price_source_t60: str = "rpc"

    # Derived
    retention_t15: Optional[float] = None       # actual / predicted
    retention_t60: Optional[float] = None
    slippage_bps: Optional[float] = None        # basis points, ratio-correct
    adverse_selection_flag: bool = False        # True if fill was against informed flow
    gate_passed: bool = False                   # True if retention_t15 > threshold

    # Metadata
    token_pair: str = ""
    notional_usd: float = 0.0
    execution_latency_ms: float = 0.0
    slot_coordinate: int = 0                    # Llullian macrocosmic slot


@dataclass
class MarkoutSummary:
    total_trades: int
    total_predicted_pnl: float
    total_actual_pnl_t15: float
    total_actual_pnl_t60: float
    alpha_retention_t15: float
    alpha_retention_t60: float
    gate_threshold: float
    gate_passed: bool

    # Distribution
    retention_mean: float
    retention_stdev: float
    retention_min: float
    retention_max: float
    trades_below_gate: int

    # Adverse selection
    adverse_selection_count: int
    adverse_selection_rate: float

    # Capacity ceiling
    capacity_ceiling_usd: float     # Notional at which retention crosses gate threshold

    # Provenance of the numbers above. gate_pure=False means at least one trade
    # was scaled by a synthetic multiplier, so the retention figures are not
    # evidence of on-chain truth.
    fallback_trade_count: int
    fallback_rate: float
    gate_pure: bool

    conclusion: str
    timestamp: float = field(default_factory=time.time)
    report_signature: str = ""      # SHA-256 of summary for audit trail


# ---------------------------------------------------------------------------
# RPC Hook — Wire your Monad client here
# ---------------------------------------------------------------------------

async def _default_price_fetcher(
    trade_id: str,
    token_pair: str,
    delay_seconds: int
) -> Optional[float]:
    """
    STUB — returns None, which routes the trade onto the fallback multiplier.

    This is intentionally NOT an RPC client. Wire one in at construction:

        analyzer = ShadowMarkoutAnalyzer(
            price_fetcher=monad_price_fetcher,   # from monad_price_fetcher.py
        )

    Leaving this in place is a valid *degraded* configuration, but every trade
    it touches is recorded as price_source='fallback' and forces
    summary.gate_pure = False. Do not read such a summary as proof that alpha
    retained on chain.
    """
    await asyncio.sleep(delay_seconds)
    return None


# ---------------------------------------------------------------------------
# Core Analyzer
# ---------------------------------------------------------------------------

class ShadowMarkoutAnalyzer:
    """
    Hardened shadow-paper markout analyzer.

    Usage:
        analyzer = ShadowMarkoutAnalyzer(
            target_trades=50,
            gate_threshold=0.80,
            output_dir="./.runtime_state/markout",
            price_fetcher=your_monad_rpc_price_function   # required for pure results
        )

        for plan in execution_plans:
            await analyzer.process_execution_plan(plan)

        summary = await analyzer.finalize_analysis()
    """

    MARKOUT_WINDOWS = [15, 60]   # seconds

    def __init__(
        self,
        target_trades: int = 50,
        gate_threshold: float = 0.80,
        output_dir: str = "./.runtime_state/markout",
        price_fetcher: Optional[Callable[..., Awaitable[Optional[float]]]] = None,
        fallback_slippage_t15: float = 0.95,    # used ONLY if RPC unavailable
        fallback_slippage_t60: float = 0.90,
    ):
        self.target_trades = target_trades
        self.gate_threshold = gate_threshold
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.price_fetcher = price_fetcher or _default_price_fetcher
        self.fallback_slippage_t15 = fallback_slippage_t15
        self.fallback_slippage_t60 = fallback_slippage_t60
        self.using_default_fetcher = price_fetcher is None

        self.recorded_trades: List[TradeRecord] = []
        self.window_closed = False
        self._finalize_lock = asyncio.Lock()  # prevents duplicate finalize on concurrent completion

        logger.info(
            f"ShadowMarkoutAnalyzer initialized | "
            f"target={target_trades} trades | gate={gate_threshold*100:.0f}% | "
            f"output={self.output_dir} | "
            f"price_fetcher={'DEFAULT(stub)' if self.using_default_fetcher else 'wired'}"
        )
        if self.using_default_fetcher:
            logger.warning(
                "No price_fetcher supplied. Every trade will fall back to synthetic "
                "slippage multipliers and summary.gate_pure will be False."
            )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def process_execution_plan(self, plan_payload: dict):
        """Ingest one execution plan and record its markout."""
        if self.window_closed:
            return

        trade = TradeRecord(
            id=plan_payload.get("id", str(int(time.time() * 1000))),
            predicted_pnl=plan_payload.get("predicted_pnl", 0.0),
            entry_price=plan_payload.get("entry_price", 0.0),
            entry_timestamp=time.time(),
            token_pair=plan_payload.get("token_pair", "UNKNOWN/USDC"),
            notional_usd=plan_payload.get("notional_usd", 0.0),
            execution_latency_ms=plan_payload.get("execution_latency_ms", 0.0),
            slot_coordinate=plan_payload.get("slot_coordinate", 0),
        )

        # Fetch T+15s and T+60s realized prices concurrently — 60s wall time, not 75s
        price_t15, price_t60 = await asyncio.gather(
            self.price_fetcher(trade.id, trade.token_pair, 15),
            self.price_fetcher(trade.id, trade.token_pair, 60),
        )

        if price_t15 is not None and trade.entry_price > 0:
            trade.price_t15 = price_t15
            trade.actual_pnl_t15 = self._compute_realized_pnl(
                trade.predicted_pnl, trade.entry_price, price_t15
            )
        else:
            # RPC unavailable — synthetic multiplier, recorded as such.
            trade.price_source_t15 = "fallback"
            trade.actual_pnl_t15 = trade.predicted_pnl * self.fallback_slippage_t15
            logger.info(f"[{trade.id}] T+15s RPC unavailable — using fallback multiplier")

        if price_t60 is not None and trade.entry_price > 0:
            trade.price_t60 = price_t60
            trade.actual_pnl_t60 = self._compute_realized_pnl(
                trade.predicted_pnl, trade.entry_price, price_t60
            )
        else:
            trade.price_source_t60 = "fallback"
            trade.actual_pnl_t60 = trade.predicted_pnl * self.fallback_slippage_t60
            if price_t60 is None:
                logger.info(f"[{trade.id}] T+60s RPC unavailable — using fallback multiplier")

        # Derived fields
        if trade.predicted_pnl > 0:
            trade.retention_t15 = trade.actual_pnl_t15 / trade.predicted_pnl
            trade.retention_t60 = trade.actual_pnl_t60 / trade.predicted_pnl
            # Correct bps: ratio-based, not dollar-based
            trade.slippage_bps = (
                (trade.predicted_pnl - trade.actual_pnl_t15) / trade.predicted_pnl
            ) * 10_000
        else:
            trade.retention_t15 = 0.0
            trade.retention_t60 = 0.0
            trade.slippage_bps = 0.0

        # Adverse selection: flag if retention < 70% (informed flow likely)
        trade.adverse_selection_flag = trade.retention_t15 < ADVERSE_SELECTION_RETENTION

        trade.gate_passed = trade.retention_t15 >= self.gate_threshold

        self.recorded_trades.append(trade)

        logger.info(
            f"Trade {trade.id} | "
            f"Predicted: ${trade.predicted_pnl:.4f} | "
            f"T+15s: ${trade.actual_pnl_t15:.4f} | "
            f"Retention: {trade.retention_t15*100:.1f}% | "
            f"Slippage: {trade.slippage_bps:.1f}bps | "
            f"src={trade.price_source_t15} | "
            f"{'ADVERSE' if trade.adverse_selection_flag else 'OK'}"
        )

        if len(self.recorded_trades) >= self.target_trades:
            async with self._finalize_lock:
                if not self.window_closed:  # double-check inside lock
                    await self.finalize_analysis()

    def process_execution_plan_sync(self, plan_payload: dict):
        """Synchronous wrapper for non-async contexts."""
        asyncio.run(self.process_execution_plan(plan_payload))

    # ------------------------------------------------------------------
    # Analysis
    # ------------------------------------------------------------------

    async def finalize_analysis(self) -> dict:
        """
        Compute summary, write all outputs, evaluate gate.

        Returns the summary dict (the upstream snapshot annotated this
        `-> MarkoutSummary` but returned a dict; the annotation was corrected
        here rather than changing the return shape that callers persist).
        """
        n = len(self.recorded_trades)
        logger.info(
            f"--- SHADOW-PAPER MARKOUT ANALYSIS COMPLETE ({n} TRADES) ---"
        )

        retentions = [t.retention_t15 for t in self.recorded_trades if t.retention_t15 is not None]
        total_predicted = sum(t.predicted_pnl for t in self.recorded_trades)
        total_t15 = sum(t.actual_pnl_t15 for t in self.recorded_trades)
        total_t60 = sum(t.actual_pnl_t60 for t in self.recorded_trades)

        alpha_t15 = (total_t15 / total_predicted * 100) if total_predicted > 0 else 0.0
        alpha_t60 = (total_t60 / total_predicted * 100) if total_predicted > 0 else 0.0

        adverse_count = sum(1 for t in self.recorded_trades if t.adverse_selection_flag)
        below_gate = sum(1 for t in self.recorded_trades if not t.gate_passed)
        fallback_count = sum(1 for t in self.recorded_trades if t.price_source_t15 == "fallback")
        gate_pure = fallback_count == 0 and n > 0

        gate_passed = alpha_t15 / 100 >= self.gate_threshold

        # Capacity ceiling: largest notional batch where mean retention stays >= gate
        capacity_ceiling = self._estimate_capacity_ceiling()

        if not gate_pure:
            conclusion = (
                "CONCLUSION: IMPURE SAMPLE. At least one trade was scaled by a "
                "synthetic fallback multiplier because no realized price was "
                "available. The retention figures below are NOT evidence of "
                "on-chain execution truth. Wire a price_fetcher and re-run "
                "before drawing any conclusion about alpha."
            )
        elif gate_passed:
            conclusion = (
                "CONCLUSION: Markout rules satisfied. Agent 0 exhibits stable off-chain "
                "execution truth. Ready for Explicit Operator Review."
            )
        else:
            conclusion = (
                "CONCLUSION: High slippage detected. Do not grant live capital authority."
            )

        summary_dict = {
            "total_trades": n,
            "total_predicted_pnl": total_predicted,
            "total_actual_pnl_t15": total_t15,
            "total_actual_pnl_t60": total_t60,
            "alpha_retention_t15": alpha_t15,
            "alpha_retention_t60": alpha_t60,
            "gate_threshold": self.gate_threshold * 100,
            "gate_passed": gate_passed,
            "retention_mean": mean(retentions) * 100 if retentions else 0.0,
            "retention_stdev": stdev(retentions) * 100 if len(retentions) > 1 else 0.0,
            "retention_min": min(retentions) * 100 if retentions else 0.0,
            "retention_max": max(retentions) * 100 if retentions else 0.0,
            "trades_below_gate": below_gate,
            "adverse_selection_count": adverse_count,
            "adverse_selection_rate": (adverse_count / n * 100) if n else 0.0,
            "capacity_ceiling_usd": capacity_ceiling,
            "fallback_trade_count": fallback_count,
            "fallback_rate": (fallback_count / n * 100) if n else 100.0,
            "gate_pure": gate_pure,
            "conclusion": conclusion,
            "timestamp": time.time(),
            "source_sha256": SOURCE_SHA256,
        }

        # Sign the summary for audit trail
        sig_input = json.dumps(summary_dict, sort_keys=True).encode()
        summary_dict["report_signature"] = hashlib.sha256(sig_input).hexdigest()[:16]

        # ---- Log summary ----
        logger.info(f"Total Predicted PnL:    ${total_predicted:.2f}")
        logger.info(f"Total Actual T+15s PnL: ${total_t15:.2f}")
        logger.info(f"Total Actual T+60s PnL: ${total_t60:.2f}")
        logger.info(f"Alpha Retention T+15s:  {alpha_t15:.2f}%")
        logger.info(f"Alpha Retention T+60s:  {alpha_t60:.2f}%")
        logger.info(f"Gate Threshold:         >{self.gate_threshold*100:.0f}%")
        logger.info(f"Trades Below Gate:      {below_gate}/{n}")
        logger.info(f"Adverse Selection:      {adverse_count} trades ({(adverse_count/n*100) if n else 0:.1f}%)")
        logger.info(f"Fallback (impure) trades: {fallback_count}/{n}")
        logger.info(f"Capacity Ceiling:       ${capacity_ceiling:,.0f}")
        logger.info(f"Status:                 {'PASSED' if gate_passed else 'FAILED'}"
                    f"{'' if gate_pure else ' (IMPURE SAMPLE)'}")
        logger.info(conclusion)

        # ---- Persist outputs ----
        self._write_json(summary_dict)
        self._write_trades_json()
        self._write_trades_csv()

        self.window_closed = True
        return summary_dict

    # ------------------------------------------------------------------
    # Query helpers — call these after finalize_analysis()
    # ------------------------------------------------------------------

    def get_trades_below_gate(self) -> List[TradeRecord]:
        """Return all trades that failed the retention gate."""
        return [t for t in self.recorded_trades if not t.gate_passed]

    def get_adverse_selection_trades(self) -> List[TradeRecord]:
        """Return trades flagged for adverse selection (retention < 70%)."""
        return [t for t in self.recorded_trades if t.adverse_selection_flag]

    def get_worst_n_trades(self, n: int = 10) -> List[TradeRecord]:
        """Return the N trades with lowest T+15s retention."""
        return sorted(
            self.recorded_trades,
            key=lambda t: t.retention_t15 or 0.0
        )[:n]

    def get_best_n_trades(self, n: int = 10) -> List[TradeRecord]:
        """Return the N trades with highest T+15s retention."""
        return sorted(
            self.recorded_trades,
            key=lambda t: t.retention_t15 or 0.0,
            reverse=True
        )[:n]

    def get_retention_by_slot(self) -> Dict[int, float]:
        """Mean retention grouped by Llullian macrocosmic slot coordinate."""
        from collections import defaultdict
        slot_retentions = defaultdict(list)
        for t in self.recorded_trades:
            if t.retention_t15 is not None:
                slot_retentions[t.slot_coordinate].append(t.retention_t15)
        return {
            slot: mean(vals) * 100
            for slot, vals in slot_retentions.items()
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _compute_realized_pnl(
        self,
        predicted_pnl: float,
        entry_price: float,
        exit_price: float
    ) -> float:
        """
        Compute realized PnL from actual price move.
        Scales predicted PnL by the ratio of actual-to-expected price movement.
        Wire your position-sizing logic here if needed.
        """
        if entry_price <= 0:
            return predicted_pnl
        price_ratio = exit_price / entry_price
        return predicted_pnl * price_ratio

    def _estimate_capacity_ceiling(self) -> float:
        """
        Estimate max notional per trade before retention crosses gate.
        Uses the observed slippage_bps distribution — larger size = more slippage.
        Returns USD ceiling where expected retention = gate_threshold.
        This is a linear approximation; replace with market-impact model if available.
        """
        slippages = [t.slippage_bps for t in self.recorded_trades if t.slippage_bps is not None]
        notionals = [t.notional_usd for t in self.recorded_trades if t.notional_usd > 0]

        if not slippages or not notionals:
            return 0.0

        avg_slippage_bps = mean(slippages)
        avg_notional = mean(notionals)

        if avg_slippage_bps <= 0 or avg_notional <= 0:
            return float("inf")

        # bps-per-dollar rate (linear impact assumption)
        impact_rate = avg_slippage_bps / avg_notional

        # Gate tolerance in bps
        gate_tolerance_bps = (1.0 - self.gate_threshold) * 10_000

        if impact_rate <= 0:
            return float("inf")

        return gate_tolerance_bps / impact_rate

    def _write_json(self, summary: dict):
        path = self.output_dir / "markout_summary.json"
        with open(path, "w") as f:
            json.dump(summary, f, indent=2)
        logger.info(f"Summary written -> {path}")

    def _write_trades_json(self):
        path = self.output_dir / "markout_trades.json"
        with open(path, "w") as f:
            json.dump([asdict(t) for t in self.recorded_trades], f, indent=2)
        logger.info(f"Trade log written -> {path}")

    def _write_trades_csv(self):
        path = self.output_dir / "markout_trades.csv"
        if not self.recorded_trades:
            return
        fields = list(asdict(self.recorded_trades[0]).keys())
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            writer.writerows([asdict(t) for t in self.recorded_trades])
        logger.info(f"CSV written -> {path}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # The upstream snapshot imported monad_price_fetcher here. That module stays
    # in the external engine repo; import it lazily so this file remains runnable
    # (and testable) in the monorepo without it.
    try:
        from monad_price_fetcher import monad_price_fetcher
    except ImportError:
        monad_price_fetcher = None
        logging.getLogger(__name__).warning(
            "monad_price_fetcher not importable; running with the stub fetcher. "
            "All trades will be marked fallback and gate_pure will be False."
        )

    async def main():
        analyzer = ShadowMarkoutAnalyzer(
            target_trades=50,
            gate_threshold=0.80,
            output_dir="./.runtime_state/markout",
            price_fetcher=monad_price_fetcher,
        )

        plans = [
            {
                "id": f"trade_mock_{i:03d}",
                "predicted_pnl": 0.75 + (i * 0.01),
                "entry_price": 1.00,
                "token_pair": "MON/USDC",
                "notional_usd": 1000.0,
                "execution_latency_ms": 12.0 + (i % 5),
                "slot_coordinate": i % 144,
            }
            for i in range(50)
        ]

        # All 50 trades fire simultaneously — total wall time = 60s not 62.5 min
        await asyncio.gather(*[analyzer.process_execution_plan(p) for p in plans])

        # --- Query individual trade data ---
        print("\n=== WORST 5 TRADES ===")
        for t in analyzer.get_worst_n_trades(5):
            print(f"  {t.id} | retention={t.retention_t15*100:.1f}% | slippage={t.slippage_bps:.1f}bps")

        print("\n=== ADVERSE SELECTION TRADES ===")
        adverse = analyzer.get_adverse_selection_trades()
        print(f"  {len(adverse)} trades flagged (retention < 70%)")

        print("\n=== RETENTION BY LLULLIAN SLOT ===")
        by_slot = analyzer.get_retention_by_slot()
        for slot, ret in sorted(by_slot.items())[:5]:
            print(f"  Slot {slot:03d}: {ret:.1f}%")

        if monad_price_fetcher is not None:
            from monad_price_fetcher import _close_http_client
            try:
                await _close_http_client()
            except Exception:
                pass

    asyncio.run(main())