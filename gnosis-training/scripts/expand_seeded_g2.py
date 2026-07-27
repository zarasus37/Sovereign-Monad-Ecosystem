#!/usr/bin/env python3
"""GP-4: Seeded G2 expansion from preference_pairs_ALL.jsonl.

  python scripts/expand_seeded_g2.py
  python scripts/expand_seeded_g2.py --variants 8 --append-all

Default writes data/preference_pairs_G2_expand.jsonl only.
--append-all merges into preference_pairs_ALL.jsonl (idempotent on PP-G2-*).
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from gnosis_training.expand_g2 import (  # noqa: E402
    expand_corpus,
    load_pairs_jsonl,
    write_pairs_jsonl,
)
from gnosis_training.preference import (  # noqa: E402
    detect_worksheet_templating,
    pair_from_wire,
    pair_to_wire,
    serialize_pairs_jsonl,
    validate_pair,
)

ROOT = Path(__file__).resolve().parents[2]
ALL = ROOT / "gnosis-training" / "data" / "preference_pairs_ALL.jsonl"
OUT = ROOT / "gnosis-training" / "data" / "preference_pairs_G2_expand.jsonl"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--variants", type=int, default=8, help="variants per seed (max 8 recipes)")
    ap.add_argument(
        "--categories",
        type=str,
        default="",
        help="comma list e.g. CAT7,CAT8 (default: all)",
    )
    ap.add_argument("--max-seeds", type=int, default=None)
    ap.add_argument(
        "--append-all",
        action="store_true",
        help="append G2 rows into preference_pairs_ALL.jsonl",
    )
    args = ap.parse_args()

    seeds = load_pairs_jsonl(ALL)
    # Prefer expanding G0/G1 only (not prior G2)
    seeds = [
        p
        for p in seeds
        if (p.provenance_tier in (None, "G0", "G1") or p.provenance_tier is None)
        and not (p.pair_id or "").startswith("PP-G2-")
    ]
    cats = {c.strip() for c in args.categories.split(",") if c.strip()} or None
    expanded = expand_corpus(
        seeds,
        variants_per_seed=args.variants,
        categories=cats,
        max_seeds=args.max_seeds,
    )
    if not expanded:
        print("no expanded pairs produced")
        return 1

    # Validate each
    bad = 0
    for p in expanded:
        probs = validate_pair(p)
        if probs:
            bad += 1
    if bad:
        print(f"warning: {bad} variants failed validate_pair (should be 0)")

    write_pairs_jsonl(OUT, expanded)
    print(f"wrote {len(expanded)} G2 pairs → {OUT}")
    print(f"  by_category={dict(Counter(p.category for p in expanded))}")
    print(f"  seeds_used≈{len({(p.seed_pair_ids or [''])[0] for p in expanded})}")

    if args.append_all:
        existing = [
            ln for ln in ALL.read_text(encoding="utf-8").splitlines() if ln.strip()
        ]
        existing_ids = {json.loads(ln)["pair_id"] for ln in existing}
        if any(i.startswith("PP-G2-") for i in existing_ids):
            print("ALL already has PP-G2-*; skip append (idempotent)")
            return 0
        combined = [pair_from_wire(json.loads(ln)) for ln in existing] + expanded
        # Diversity guard on full set — may fail if too templated; try anyway
        templating = detect_worksheet_templating(combined)
        if templating:
            print(f"templating guard on full ALL+G2: {templating}")
            print("  writing G2 file only; NOT appending to ALL")
            return 1
        with ALL.open("a", encoding="utf-8") as fh:
            for p in expanded:
                fh.write(json.dumps(pair_to_wire(p), ensure_ascii=False) + "\n")
        print(f"appended {len(expanded)} → {ALL} (new total ≈ {len(existing)+len(expanded)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
