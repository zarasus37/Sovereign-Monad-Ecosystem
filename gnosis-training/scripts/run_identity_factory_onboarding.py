#!/usr/bin/env python3
"""Run identity-factory G1 for onboarding Council members (TRAINING ONLY).

Embeds each member's THE COUNCILE literature (full pack), parses gnosis events,
emits preference pairs grounded in those events — temporary persona for corpus
build only, not product agents.

Usage:
  cd gnosis-training
  uv run python scripts/run_identity_factory_onboarding.py
  uv run python scripts/run_identity_factory_onboarding.py --min-confidence 0.8
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "gnosis-training" / "src"))

from gnosis_training.council_identity_factory import (  # noqa: E402
    ONBOARDING_MEMBER_IDS,
    build_identity_pairs,
    write_identity_pairs,
)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--out",
        type=Path,
        default=ROOT
        / "gnosis-training"
        / "data"
        / "council_g1_identity_onboarding.jsonl",
    )
    ap.add_argument("--min-confidence", type=float, default=0.75)
    ap.add_argument("--max-events", type=int, default=None)
    ap.add_argument(
        "--report",
        type=Path,
        default=ROOT / "logs" / "gnosis" / "identity_factory_onboarding.json",
    )
    args = ap.parse_args()

    pairs, report = build_identity_pairs(
        ONBOARDING_MEMBER_IDS,
        min_confidence=args.min_confidence,
        max_events_per_member=args.max_events,
    )
    summary = write_identity_pairs(pairs, args.out)
    report["write"] = summary
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print("identity-factory onboarding (TRAINING CORPUS ONLY)")
    print(f"  members={len(ONBOARDING_MEMBER_IDS)}")
    for mid, info in report["members"].items():
        print(
            f"  {mid}: events_parsed={info['events_parsed']} "
            f"used={info['events_used']} chars={info['char_count']}"
        )
    print(f"  wrote={summary['wrote']} invalid={summary['invalid']}")
    print(f"  → {summary['path']}")
    print(f"  report → {args.report}")
    print("  Spot-review before promote into preference_pairs_ALL.jsonl")
    return 0 if summary["invalid"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
