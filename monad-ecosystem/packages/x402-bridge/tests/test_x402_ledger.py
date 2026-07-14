#!/usr/bin/env python3
"""
Test the x402 drawdown ledger (ledger.py) — offline, no funded wallet.

Validates:
  1. LedgerEntry determinism: same tuple → same id; id is a stable uuid5
  2. DrawdownLedger append-only JSONL round-trip + sum_credits_spent + tail
  3. credits_spent derived from before/after; None when either missing
  4. to_signal_event() mirrors @sovereign/types SignalEvent + RevenueEvent shape
  5. LedgerTrace provenance block round-trips through as_dict
  6. Dead-letter entry (exhausted) persists dlq_reason

Usage:
  python tests/test_x402_ledger.py
  python tests/test_x402_ledger.py --verbose
"""

import sys
import os
import json
import tempfile
from decimal import Decimal
from pathlib import Path

src_dir = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_dir))


def log(msg: str):
    print(msg)


def test_1_id_determinism():
    log("\n[1/6] Testing LedgerEntry id determinism (uuid5, stable tuple)...")
    from x402_bridge.ledger import LedgerEntry
    a = LedgerEntry(timestamp="t1", agent_id="ag", endpoint="e",
                    payment_model="credit-drawdown", attempts=1, status="paid")
    b = LedgerEntry(timestamp="t1", agent_id="ag", endpoint="e",
                    payment_model="credit-drawdown", attempts=1, status="paid")
    c = LedgerEntry(timestamp="t1", agent_id="ag", endpoint="e",
                    payment_model="credit-drawdown", attempts=2, status="paid")
    assert a.id == b.id, (a.id, b.id)
    assert a.id != c.id, (a.id, c.id)  # attempts differs → different id
    assert isinstance(a.id, str) and len(a.id) == 36, a.id
    log(f"  ✅ same tuple → same id ({a.id}); differing attempts → differing id")
    return True


def test_2_roundtrip():
    log("\n[2/6] Testing DrawdownLedger append-only JSONL round-trip...")
    from x402_bridge.ledger import DrawdownLedger, LedgerEntry
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "ledger.jsonl")
        lg = DrawdownLedger(p)
        e1 = LedgerEntry(timestamp="t1", agent_id="ag", endpoint="e",
                         payment_model="credit-drawdown", attempts=1, status="paid",
                         credits_before=1000, credits_after=999,
                         usd_notional=Decimal("0.001"))
        eid = lg.append(e1)
        e2 = LedgerEntry(timestamp="t2", agent_id="ag", endpoint="e",
                         payment_model="credit-drawdown", attempts=3, status="exhausted",
                         dlq_reason="max-retries-exhausted")
        lg.append(e2)
        rows = lg.read_all()
        assert len(rows) == 2, rows
        assert rows[0]["id"] == eid, rows[0]
        assert rows[0]["status"] == "paid", rows[0]
        assert rows[1]["dlq_reason"] == "max-retries-exhausted", rows[1]
        # sum_credits_spent only counts entries with both balances
        assert lg.sum_credits_spent() == 1, lg.sum_credits_spent()
        # tail
        assert len(lg.tail(5)) == 2 and len(lg.tail(1)) == 1
        # file is one JSON object per line
        text = Path(p).read_text(encoding="utf-8").strip().splitlines()
        assert len(text) == 2, text
        for line in text:
            json.loads(line)  # each line is valid JSON
        log("  ✅ append → read_all → sum_credits_spent=1; one JSON object per line")
    return True


def test_3_credits_spent():
    log("\n[3/6] Testing credits_spent derivation...")
    from x402_bridge.ledger import LedgerEntry
    e = LedgerEntry(timestamp="t", agent_id="ag", endpoint="e",
                    payment_model="credit-drawdown", attempts=1, status="paid",
                    credits_before=100, credits_after=90)
    assert e.credits_spent == 10, e.credits_spent
    e2 = LedgerEntry(timestamp="t", agent_id="ag", endpoint="e",
                     payment_model="credit-drawdown", attempts=1, status="paid",
                     credits_after=90)  # before missing
    assert e2.credits_spent is None, e2.credits_spent
    log("  ✅ credits_spent=10 with both balances; None when before missing")
    return True


def test_4_signal_event_shape():
    log("\n[4/6] Testing to_signal_event() mirrors SignalEvent + RevenueEvent...")
    from x402_bridge.ledger import LedgerEntry
    e = LedgerEntry(timestamp="t", agent_id="ag", endpoint="monad-mainnet",
                    payment_model="credit-drawdown", attempts=1, status="paid",
                    credits_before=100, credits_after=99,
                    usd_notional=Decimal("0.001"))
    se = e.to_signal_event()
    # SignalEvent envelope fields (signal.ts:115)
    for k in ("id", "correlationId", "timestamp", "layer", "source", "type",
             "payload", "hash", "severity", "trace"):
        assert k in se, (k, se)
    assert se["layer"] == "system", se["layer"]
    assert se["type"] == "cost.drawdown", se["type"]
    assert se["source"] == "ag", se["source"]
    assert se["severity"] == "info", se["severity"]  # paid → info
    # payload mirrors the outflow RevenueEvent shape (revenue.ts:44 fields)
    for k in ("id", "timestamp", "agent_id", "endpoint", "payment_model", "attempts",
             "status", "credits_before", "credits_after", "credits_spent",
             "usd_notional", "tx_hash", "block_number", "dlq_reason"):
        assert k in se["payload"], (k, se["payload"])
    assert se["payload"]["usd_notional"] == "0.001", se["payload"]  # Decimal as str
    # warning severity on non-paid
    e_fail = LedgerEntry(timestamp="t", agent_id="ag", endpoint="e",
                         payment_model="credit-drawdown", attempts=3,
                         status="exhausted", dlq_reason="max-retries-exhausted")
    assert e_fail.to_signal_event()["severity"] == "warning"
    log("  ✅ SignalEvent envelope + RevenueEvent-mirrored payload present; severity by status")
    return True


def test_5_trace_roundtrip():
    log("\n[5/6] Testing LedgerTrace provenance block round-trips...")
    from x402_bridge.ledger import DrawdownLedger, LedgerEntry, LedgerTrace
    trace = LedgerTrace(intention_id="i1", constraint_envelope_id="ce1",
                        narrative_purpose_id="np1")
    e = LedgerEntry(timestamp="t", agent_id="ag", endpoint="e",
                    payment_model="credit-drawdown", attempts=1, status="paid",
                    trace=trace)
    d = e.as_dict()
    assert d["trace"] == {
        "intention_id": "i1", "source": None, "parent_event_id": None,
        "constraint_envelope_id": "ce1", "narrative_purpose_id": "np1",
    }, d["trace"]
    # persists through JSONL
    with tempfile.TemporaryDirectory() as dir_:
        p = os.path.join(dir_, "l.jsonl")
        lg = DrawdownLedger(p)
        lg.append(e)
        row = lg.read_all()[0]
        assert row["trace"]["constraint_envelope_id"] == "ce1", row["trace"]
    log("  ✅ trace block mirrors EventTrace + survives JSONL persistence")
    return True


def test_6_dead_letter_persists():
    log("\n[6/6] Testing dead-letter entry persists dlq_reason...")
    from x402_bridge.ledger import DrawdownLedger, LedgerEntry
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "dlq.jsonl")
        lg = DrawdownLedger(p)
        e = LedgerEntry(timestamp="t", agent_id="ag", endpoint="e",
                        payment_model="pay-per-request", attempts=4,
                        status="exhausted", dlq_reason="max-retries-exhausted")
        lg.append(e)
        row = lg.read_all()[0]
        assert row["status"] == "exhausted", row
        assert row["dlq_reason"] == "max-retries-exhausted", row
        assert row["attempts"] == 4, row
        log("  ✅ dead-letter (exhausted) persists status + dlq_reason + attempts")
    return True


def main():
    print("=" * 60)
    print("x402 Drawdown Ledger Test Suite (offline)")
    print("=" * 60)
    results = []
    results.append(("id determinism", test_1_id_determinism()))
    results.append(("JSONL round-trip", test_2_roundtrip()))
    results.append(("credits_spent", test_3_credits_spent()))
    results.append(("signal_event shape", test_4_signal_event_shape()))
    results.append(("trace round-trip", test_5_trace_roundtrip()))
    results.append(("dead-letter persists", test_6_dead_letter_persists()))
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    print("\n" + "=" * 60)
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 60)
    for name, ok in results:
        print(f"  {'✅ PASS' if ok else '❌ FAIL'} — {name}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())