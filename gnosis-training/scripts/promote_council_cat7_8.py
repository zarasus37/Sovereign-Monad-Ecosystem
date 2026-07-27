#!/usr/bin/env python3
"""Promote GP-3 council CAT7/CAT8 prototype into preference_pairs_ALL.jsonl.

Idempotent: skips if any PP-C78-* already present in ALL.
Marks reviewed_by on promote (default: founder-promote).

  python scripts/promote_council_cat7_8.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from gnosis_training.preference import (  # noqa: E402
    detect_worksheet_templating,
    pair_from_wire,
    pair_to_wire,
    validate_pair,
)

ROOT = Path(__file__).resolve().parents[2]
ALL = ROOT / "gnosis-training" / "data" / "preference_pairs_ALL.jsonl"
PROTO = ROOT / "gnosis-training" / "data" / "council_cat7_8_prototype.jsonl"


def main() -> int:
    reviewed_by = "founder-promote"
    if not PROTO.exists():
        print(f"missing {PROTO} — run generate_council_cat7_8_prototype.py first")
        return 1

    existing_lines = [
        ln for ln in ALL.read_text(encoding="utf-8").splitlines() if ln.strip()
    ]
    existing_ids = {json.loads(ln)["pair_id"] for ln in existing_lines}
    if any(i.startswith("PP-C78-") for i in existing_ids):
        print("already promoted (PP-C78-* present); no-op")
        return 0

    proto_pairs = []
    for ln in PROTO.read_text(encoding="utf-8").splitlines():
        if not ln.strip():
            continue
        wire = json.loads(ln)
        wire["reviewed_by"] = reviewed_by
        # G1 stays synthetic=true (council-authored template, not pure G0 human)
        pair = pair_from_wire(wire)
        problems = validate_pair(pair)
        if problems:
            print(f"INVALID {pair.pair_id}: {problems}")
            return 1
        proto_pairs.append(pair)

    # Full-set templating guard on gold + new
    all_pairs = [pair_from_wire(json.loads(ln)) for ln in existing_lines] + proto_pairs
    templating = detect_worksheet_templating(all_pairs)
    if templating:
        print(f"templating guard failed: {templating}")
        return 1

    with ALL.open("a", encoding="utf-8") as fh:
        for p in proto_pairs:
            fh.write(json.dumps(pair_to_wire(p), ensure_ascii=False) + "\n")

    print(f"promoted {len(proto_pairs)} pairs → {ALL}")
    print(f"  new total ≈ {len(existing_lines) + len(proto_pairs)}")
    print(f"  reviewed_by={reviewed_by} provenance=G1")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
