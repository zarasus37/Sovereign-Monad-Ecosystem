"""
Shadow Markout oracle test shim.

Spawned by monad-ecosystem/tests/integration/shadow-markout-oracle.test.ts,
following the same pattern as gnostic-engine/tests/_parity_shim.py (see
_parity.ts): JSON request on stdin, JSON response on stdout.

Two modes:

  gate        — batch-run shadow_markout_gate.evaluate_per_trade over a list of
                cases. No third-party dependencies, so this works under a bare
                `python` with nothing installed.

  hardened    — run the ported shadow_markout_hardened analyzer over synthetic
                plans with an injected price_fetcher, and report retention /
                adverse-selection / capacity-ceiling / gate_pure.

Neither mode touches the network or sleeps in wall-clock time: the hardened
mode injects a deterministic fetcher instead of the T+15s/T+60s RPC path.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

PY_DIR = Path(__file__).resolve().parents[2] / "packages" / "loop" / "python"
sys.path.insert(0, str(PY_DIR))


def run_gate(payload: dict) -> dict:
    from shadow_markout_gate import GateConfig, evaluate_per_trade

    cfg = GateConfig.from_env()
    now = payload.get("now")
    results = []
    for case in payload.get("cases", []):
        try:
            v = evaluate_per_trade(
                pool_address=case.get("pool_address") or ("0x" + "22" * 20),
                amount_in_usd=case["amount_in_usd"],
                is_buy=case.get("is_buy", True),
                pyth_data=case["pyth_price_update"],
                expected_edge_bps=case.get("expected_edge_bps"),
                config=cfg,
                now=now,
            )
            results.append({
                "name": case.get("name"),
                "verdict": v.verdict,
                "expected_slippage": v.expected_slippage,
                "shadow_profit_usd": v.shadow_profit_usd,
                "audit_id": v.audit_id,
                "reason": v.reason,
                "metrics": v.metrics,
            })
        except Exception as exc:  # surface as data; the test asserts on it
            results.append({"name": case.get("name"), "error": f"{type(exc).__name__}: {exc}"})
    return {
        "config_fingerprint": cfg.fingerprint(),
        "results": results,
    }


def run_hardened(payload: dict) -> dict:
    from shadow_markout_hardened import ShadowMarkoutAnalyzer, SOURCE_SHA256

    plans = payload["plans"]
    entry_price = float(payload.get("entry_price", 1.0))
    # Deterministic multiplier per plan id so retention is reproducible and does
    # not depend on wall-clock pricing. id "good" → alpha retained; "thin" →
    # alpha largely eaten by slippage (adverse selection).
    def fetcher(trade_id: str, token_pair: str, delay_seconds: int):
        factor = 1.0 if "good" in trade_id else 0.5
        async def _read():
            return entry_price * factor
        return _read()

    async def main():
        analyzer = ShadowMarkoutAnalyzer(
            target_trades=len(plans),
            gate_threshold=payload.get("gate_threshold", 0.80),
            output_dir=payload["output_dir"],
            price_fetcher=fetcher,
        )
        await asyncio.gather(*[analyzer.process_execution_plan(p) for p in plans])
        summary = await analyzer.finalize_analysis()
        return {
            "source_sha256": SOURCE_SHA256,
            "summary": summary,
            "adverse_ids": [t.id for t in analyzer.get_adverse_selection_trades()],
            "below_gate_ids": [t.id for t in analyzer.get_trades_below_gate()],
            "retention_by_slot": {str(k): v for k, v in analyzer.get_retention_by_slot().items()},
            "trade_price_sources": {
                t.id: t.price_source_t15 for t in analyzer.recorded_trades
            },
        }

    return asyncio.run(main())


def run_fallback(payload: dict) -> dict:
    """Prove the degraded path is visible rather than silent.

    A fetcher that returns None is exactly the condition the analyzer treats as
    'no realized price', so this exercises the same fallback branch as the
    unwired default — without the default's 60s T+60s sleep, which would blow
    the test's spawn timeout. The unwired-constructor flag is checked
    separately, since it needs no I/O at all.
    """
    from shadow_markout_hardened import ShadowMarkoutAnalyzer

    async def _null(trade_id, token_pair, delay_seconds):
        return None

    # Constructing without a fetcher is what marks the run as unwired; assert
    # that flag without running it.
    unwired = ShadowMarkoutAnalyzer(target_trades=1, output_dir=payload["output_dir"])
    using_default = unwired.using_default_fetcher

    async def main():
        analyzer = ShadowMarkoutAnalyzer(
            target_trades=len(payload["plans"]),
            output_dir=payload["output_dir"],
            price_fetcher=_null,
        )
        await asyncio.gather(*[analyzer.process_execution_plan(p) for p in payload["plans"]])
        summary = await analyzer.finalize_analysis()
        return {
            "summary": summary,
            "using_default_fetcher_when_unwired": using_default,
            "trade_price_sources": {
                t.id: t.price_source_t15 for t in analyzer.recorded_trades
            },
        }

    return asyncio.run(main())


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "gate"
    raw = sys.stdin.read().strip()
    payload = json.loads(raw) if raw else {}
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

    if mode == "gate":
        out = run_gate(payload)
    elif mode == "hardened":
        out = run_hardened(payload)
    elif mode == "fallback":
        out = run_fallback(payload)
    else:
        raise SystemExit(f"unknown shim mode: {mode}")

    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    main()