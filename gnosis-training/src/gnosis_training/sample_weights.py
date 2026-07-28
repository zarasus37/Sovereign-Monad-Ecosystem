"""GP-7: Weighted sampling for preference training.

``P(pair) ∝ tier_weight × core_boost``

- G0/G1 and high Core Resonance motifs are seen more often
- G2/G3 bulk still trains, but at lower rate
- Implementation: **discrete oversampling** into a flat list so TRL/HF
  ``Dataset`` needs no custom Sampler (works on CPU dry-run)

See ``docs/gnosis-training/CORE_RESONANCE.md``.
"""
from __future__ import annotations

import json
import math
import random
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

from .core_resonance import (
    CORE_CATALOG,
    CoreScore,
    TIER_WEIGHTS,
    analyze_core_resonance,
    catalog_by_id,
    match_cores_in_text,
    train_sample_weight,
)
from .preference import PreferencePair


def pair_as_weight_dict(pair: PreferencePair) -> dict[str, Any]:
    """Minimal dict for ``train_sample_weight`` / core matching."""
    return {
        "pair_id": pair.pair_id,
        "prompt": pair.prompt,
        "chosen": {"response": pair.chosen.response},
        "provenance_tier": pair.provenance_tier,
        "generator": pair.generator,
        "synthetic": pair.synthetic,
        "bootstrap": pair.bootstrap,
        "core_ids": list(pair.core_ids) if pair.core_ids else None,
        "category": pair.category,
    }


def core_scores_from_report(report: dict[str, Any]) -> dict[str, CoreScore]:
    """Rebuild score map from ``core_resonance_*.json``."""
    out: dict[str, CoreScore] = {}
    cat = catalog_by_id()
    for c in report.get("cores") or []:
        cid = str(c["core_id"])
        meta = cat.get(cid)
        out[cid] = CoreScore(
            core_id=cid,
            label=str(c.get("label") or (meta.label if meta else cid)),
            direction=str(c.get("direction") or (meta.direction if meta else "")),
            member_count=int(c.get("member_count") or 0),
            members=list(c.get("members") or []),
            hit_count=float(c.get("hit_count") or 0),
            domains=list(c.get("domains") or []),
            pair_hits=int(c.get("pair_hits") or 0),
            member_source_hits=int(c.get("member_source_hits") or 0),
            score=float(c.get("score") or 0),
            rank_weight=float(c.get("rank_weight") or 0),
        )
    return out


def load_core_scores(
    report_path: Path | None = None,
    *,
    recompute: bool = False,
    pairs_path: Path | None = None,
) -> dict[str, CoreScore]:
    """Load scores from latest report, or recompute from Council + pairs."""
    if recompute:
        report = analyze_core_resonance(pairs_path=pairs_path)
        return core_scores_from_report(report)

    candidates: list[Path] = []
    if report_path:
        candidates.append(report_path)
    here = Path(__file__).resolve()
    candidates.extend(
        [
            here.parents[3] / "logs" / "gnosis" / "core_resonance_latest.json",
            Path("logs/gnosis/core_resonance_latest.json"),
            Path("../logs/gnosis/core_resonance_latest.json"),
        ]
    )
    for p in candidates:
        if p.is_file():
            data = json.loads(p.read_text(encoding="utf-8"))
            return core_scores_from_report(data)

    # Fallback: catalog zeros (tier weights only)
    return {
        c.core_id: CoreScore(
            core_id=c.core_id,
            label=c.label,
            direction=c.direction,
            member_count=0,
            members=[],
            hit_count=0.0,
            domains=list(c.domains),
            pair_hits=0,
            member_source_hits=0,
            score=0.0,
            rank_weight=0.0,
        )
        for c in CORE_CATALOG
    }


def weight_for_pair(
    pair: PreferencePair,
    core_scores: dict[str, CoreScore] | None,
) -> float:
    return train_sample_weight(pair_as_weight_dict(pair), core_scores)


@dataclass(frozen=True)
class WeightSummary:
    n: int
    mean: float
    min_w: float
    max_w: float
    by_tier: dict[str, float]
    top_pair_ids: list[tuple[str, float]]


def summarize_weights(
    pairs: Sequence[PreferencePair],
    core_scores: dict[str, CoreScore] | None,
) -> WeightSummary:
    if not pairs:
        return WeightSummary(0, 0.0, 0.0, 0.0, {}, [])
    weights = [weight_for_pair(p, core_scores) for p in pairs]
    by_tier: dict[str, list[float]] = {}
    for p, w in zip(pairs, weights):
        t = (p.provenance_tier or "G0").upper()
        by_tier.setdefault(t, []).append(w)
    tier_mean = {t: round(sum(v) / len(v), 4) for t, v in sorted(by_tier.items())}
    ranked = sorted(
        ((p.pair_id, w) for p, w in zip(pairs, weights)),
        key=lambda x: -x[1],
    )[:15]
    return WeightSummary(
        n=len(weights),
        mean=round(sum(weights) / len(weights), 4),
        min_w=round(min(weights), 4),
        max_w=round(max(weights), 4),
        by_tier=tier_mean,
        top_pair_ids=ranked,
    )


def expand_for_weighted_training(
    pairs: Sequence[PreferencePair],
    *,
    core_scores: dict[str, CoreScore] | None = None,
    target_n: int | None = None,
    seed: int = 42,
    min_copies: int = 1,
    max_copies: int = 8,
) -> list[PreferencePair]:
    """Oversample pairs so frequency ≈ weight / mean_weight.

    ``target_n`` defaults to ``len(pairs)`` (same corpus size, rebalanced) or
    pass a larger N for longer epochs without changing epoch count.
    """
    if not pairs:
        return []
    scores = core_scores if core_scores is not None else load_core_scores()
    weights = [max(1e-6, weight_for_pair(p, scores)) for p in pairs]
    mean_w = sum(weights) / len(weights)
    # copies_i ∝ w_i / mean
    raw_copies = [w / mean_w for w in weights]
    copies = [
        max(min_copies, min(max_copies, int(math.ceil(r))))
        for r in raw_copies
    ]

    # Build multiset
    expanded: list[PreferencePair] = []
    for p, c in zip(pairs, copies):
        expanded.extend([p] * c)

    rng = random.Random(seed)
    rng.shuffle(expanded)

    n = target_n if target_n is not None else len(pairs)
    if len(expanded) == n:
        return expanded
    if len(expanded) > n:
        return expanded[:n]
    # pad by weighted draws
    while len(expanded) < n:
        expanded.append(rng.choices(list(pairs), weights=weights, k=1)[0])
    rng.shuffle(expanded)
    return expanded[:n]


def pairs_to_weighted_rows(
    pairs: Sequence[PreferencePair],
    *,
    core_scores: dict[str, CoreScore] | None = None,
    expand: bool = True,
    target_n: int | None = None,
    seed: int = 42,
) -> list[dict[str, Any]]:
    """TRL-ready rows with optional oversampling + ``sample_weight`` column."""
    scores = core_scores if core_scores is not None else load_core_scores()
    use_pairs: Sequence[PreferencePair]
    if expand:
        use_pairs = expand_for_weighted_training(
            pairs, core_scores=scores, target_n=target_n, seed=seed
        )
    else:
        use_pairs = pairs

    rows: list[dict[str, Any]] = []
    for p in use_pairs:
        w = weight_for_pair(p, scores)
        cores = list(p.core_ids) if p.core_ids else match_cores_in_text(
            f"{p.prompt}\n{p.chosen.response}"
        )
        rows.append(
            {
                "prompt": p.prompt,
                "chosen": p.chosen.response,
                "rejected": p.rejected.response,
                "pair_id": p.pair_id,
                "category": p.category,
                "provenance_tier": p.provenance_tier,
                "generator": p.generator,
                "sample_weight": w,
                "core_ids": cores,
            }
        )
    return rows


def weight_histogram(rows: Sequence[dict[str, Any]]) -> dict[str, Any]:
    tiers = Counter(r.get("provenance_tier") or "?" for r in rows)
    weights = [float(r.get("sample_weight") or 0) for r in rows]
    return {
        "n": len(rows),
        "by_tier": dict(tiers),
        "weight_mean": round(sum(weights) / len(weights), 4) if weights else 0,
        "weight_min": round(min(weights), 4) if weights else 0,
        "weight_max": round(max(weights), 4) if weights else 0,
        "tier_weights_config": dict(TIER_WEIGHTS),
    }
