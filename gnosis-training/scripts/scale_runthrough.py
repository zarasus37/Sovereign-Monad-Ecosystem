#!/usr/bin/env python3
"""Full scale run-through: rebuild ALL from G0/G1 seeds + large G2 + G3.

Keeps base pairs (not PP-G2-*/PP-G3-*), regenerates expansions, writes:
  - preference_pairs_ALL.jsonl
  - preference_pairs_G2_expand.jsonl
  - preference_pairs_G3_hardneg.jsonl

Usage:
  python scripts/scale_runthrough.py
  python scripts/scale_runthrough.py --g2-variants 64 --g3-modes 8
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from gnosis_training.expand_g2 import expand_corpus, write_pairs_jsonl  # noqa: E402
from gnosis_training.hardneg_g3 import forge_corpus  # noqa: E402
from gnosis_training.preference import (  # noqa: E402
    detect_worksheet_templating,
    pair_from_wire,
    pair_to_wire,
    validate_pair,
)

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "gnosis-training" / "data"
ALL = DATA / "preference_pairs_ALL.jsonl"
G2_OUT = DATA / "preference_pairs_G2_expand.jsonl"
G3_OUT = DATA / "preference_pairs_G3_hardneg.jsonl"


def _load(path: Path) -> list:
    pairs = []
    for ln in path.read_text(encoding="utf-8").splitlines():
        if ln.strip():
            pairs.append(pair_from_wire(json.loads(ln)))
    return pairs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--g2-variants", type=int, default=64, help="max G2 variants per seed")
    ap.add_argument("--g3-modes", type=int, default=8, help="hardneg modes per seed")
    ap.add_argument("--skip-templating-guard", action="store_true")
    args = ap.parse_args()

    all_pairs = _load(ALL)
    base = [
        p
        for p in all_pairs
        if not p.pair_id.startswith("PP-G2-") and not p.pair_id.startswith("PP-G3-")
    ]
    seeds = [
        p
        for p in base
        if p.provenance_tier in (None, "G0", "G1") or p.provenance_tier in {"G0", "G1"}
    ]
    print(f"base={len(base)} seeds={len(seeds)}")

    print(f"expanding G2 variants_per_seed={args.g2_variants} ...")
    g2 = expand_corpus(seeds, variants_per_seed=args.g2_variants)
    print(f"  G2 produced={len(g2)}")

    print(f"forging G3 modes_per_seed={args.g3_modes} ...")
    g3 = forge_corpus(seeds, modes_per_seed=args.g3_modes)
    print(f"  G3 produced={len(g3)}")

    # validate sample
    for label, batch in (("G2", g2), ("G3", g3)):
        bad = sum(1 for p in batch if validate_pair(p))
        print(f"  {label} validate_pair failures={bad}")

    combined = base + g2 + g3
    if not args.skip_templating_guard:
        print("running templating guard on full combined set ...")
        problems = detect_worksheet_templating(combined)
        if problems:
            print(f"TEMPLATING GUARD: {problems}")
            print("  still writing files; review before train")
        else:
            print("  templating guard: ok")

    write_pairs_jsonl(G2_OUT, g2)
    write_pairs_jsonl(G3_OUT, g3)

    # rebuild ALL
    lines = [json.dumps(pair_to_wire(p), ensure_ascii=False) for p in combined]
    ALL.write_text("\n".join(lines) + "\n", encoding="utf-8")

    tiers = Counter(p.provenance_tier or "None" for p in combined)
    cats = Counter(p.category for p in combined)
    print(f"wrote ALL n={len(combined)} → {ALL}")
    print(f"  tiers={dict(tiers)}")
    print(f"  cats={dict(cats)}")
    print(f"  G2 file → {G2_OUT}")
    print(f"  G3 file → {G3_OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
