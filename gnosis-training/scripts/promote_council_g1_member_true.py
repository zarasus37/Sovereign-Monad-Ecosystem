#!/usr/bin/env python3
"""Promote reviewed member-true Council G1 pairs into preference_pairs_ALL.jsonl.

Usage:
  python scripts/promote_council_g1_member_true.py
  python scripts/promote_council_g1_member_true.py --src data/council_g1_member_true.jsonl

Skips pair_ids already present in ALL. Does not delete G2/G3.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "gnosis-training" / "src"))

from gnosis_training.preference import (  # noqa: E402
    pair_from_wire,
    pair_to_wire,
    validate_pair,
)

ALL = ROOT / "gnosis-training" / "data" / "preference_pairs_ALL.jsonl"
DEFAULT_SRC = ROOT / "gnosis-training" / "data" / "council_g1_member_true.jsonl"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--all", type=Path, default=ALL, dest="all_path")
    args = ap.parse_args()

    if not args.src.is_file():
        print(f"missing {args.src} — run: python -m gnosis_training council-g1-generate")
        return 1
    if not args.all_path.is_file():
        print(f"missing {args.all_path}")
        return 1

    existing_ids: set[str] = set()
    existing_lines: list[str] = []
    for ln in args.all_path.read_text(encoding="utf-8").splitlines():
        if not ln.strip():
            continue
        existing_lines.append(ln)
        existing_ids.add(str(json.loads(ln).get("pair_id")))

    added = 0
    skipped = 0
    invalid = 0
    new_lines: list[str] = []
    for ln in args.src.read_text(encoding="utf-8").splitlines():
        if not ln.strip():
            continue
        wire = json.loads(ln)
        pid = str(wire.get("pair_id"))
        if pid in existing_ids:
            skipped += 1
            continue
        pair = pair_from_wire(wire)
        problems = validate_pair(pair)
        if problems:
            print(f"skip invalid {pid}: {problems}")
            invalid += 1
            continue
        # Ensure G1 stamp
        if not pair.provenance_tier:
            wire = pair_to_wire(pair)
            wire["provenance_tier"] = "G1"
            pair = pair_from_wire(wire)
        new_lines.append(json.dumps(pair_to_wire(pair), ensure_ascii=False))
        existing_ids.add(pid)
        added += 1

    if added:
        out = existing_lines + new_lines
        args.all_path.write_text("\n".join(out) + "\n", encoding="utf-8")

    print(f"promote_council_g1: added={added} skipped_existing={skipped} invalid={invalid}")
    print(f"  ALL now ~{len(existing_lines) + added} lines → {args.all_path}")
    print("  Re-run scale_runthrough only if you want G2/G3 rebuilt from new seeds.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
