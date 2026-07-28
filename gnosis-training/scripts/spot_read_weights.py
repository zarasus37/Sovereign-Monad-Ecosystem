#!/usr/bin/env python3
"""Spot-read top-weighted G0/G1 preference pairs (GP-7 quality check)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "gnosis-training" / "src"))

from gnosis_training.core_resonance import match_cores_in_text  # noqa: E402
from gnosis_training.preference import load_human_pairs  # noqa: E402
from gnosis_training.sample_weights import load_core_scores, weight_for_pair  # noqa: E402


def cores_for(p) -> list[str]:
    found = match_cores_in_text(f"{p.prompt}\n{p.chosen.response}")
    tagged = list(p.core_ids or [])
    out: list[str] = []
    for c in tagged + found:
        if c not in out:
            out.append(c)
    return out


def main() -> int:
    corpus = ROOT / "gnosis-training" / "data" / "preference_pairs_ALL.jsonl"
    pairs = load_human_pairs(corpus)
    scores = load_core_scores()

    def w(p):
        return weight_for_pair(p, scores)

    g0 = sorted([p for p in pairs if p.provenance_tier == "G0"], key=w, reverse=True)
    g1 = sorted([p for p in pairs if p.provenance_tier == "G1"], key=w, reverse=True)

    print("=== TOP G0 by sample weight ===")
    for p in g0[:8]:
        print(
            f"  {p.pair_id} w={w(p):.3f} {p.category} cores={cores_for(p)}"
        )
        print(f"    P: {p.prompt[:140].replace(chr(10), ' ')}")

    print("\n=== TOP G1 by sample weight ===")
    for p in g1[:10]:
        print(
            f"  {p.pair_id} w={w(p):.3f} {p.category} gen={p.generator} "
            f"cores={cores_for(p)[:6]}"
        )
        print(f"    P: {p.prompt[:140].replace(chr(10), ' ')}")

    spot = g0[:4] + g1[:4]
    print("\n=== FULL SPOT READ (4 G0 + 4 G1) ===")
    for p in spot:
        gap = p.chosen.scores.total - p.rejected.scores.total
        print("\n" + "#" * 72)
        print(
            f"{p.pair_id} | {p.provenance_tier} | {p.category} | "
            f"w={w(p):.3f} | gap={gap:.3f}"
        )
        print(f"generator: {p.generator}")
        print(f"cores: {cores_for(p)}")
        print("PROMPT:")
        print(p.prompt)
        print("--- CHOSEN ---")
        ch = p.chosen.response
        print(ch if len(ch) <= 1400 else ch[:1400] + "\n...[trunc]")
        print("--- REJECTED ---")
        rj = p.rejected.response
        print(rj if len(rj) <= 600 else rj[:600] + "\n...[trunc]")
        print(f"failing: {p.failing_criteria}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
