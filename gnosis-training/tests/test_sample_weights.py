"""GP-7 weighted sampling."""
from __future__ import annotations

from gnosis_training.preference import (
    PreferencePair,
    PreferenceResponse,
    PreferenceScores,
)
from gnosis_training.sample_weights import (
    expand_for_weighted_training,
    summarize_weights,
    weight_for_pair,
    pairs_to_weighted_rows,
    core_scores_from_report,
)


def _pair(
    pid: str,
    tier: str,
    *,
    chosen: str = "generic answer",
    core_ids: list[str] | None = None,
) -> PreferencePair:
    s_hi = PreferenceScores(0.9, 0.9, 0.9, 0.9, 0.9, 0.9)
    s_lo = PreferenceScores(0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    return PreferencePair(
        pair_id=pid,
        category="CAT1",
        prompt="q?",
        chosen=PreferenceResponse(chosen, s_hi, ""),
        rejected=PreferenceResponse("bad", s_lo, ""),
        failing_criteria=["C1"],
        apeiron=False,
        bootstrap=False,
        constitution_version="v2.0",
        synthetic=tier != "G0",
        provenance_tier=tier,
        seed_pair_ids=["PP-001"] if tier == "G2" else [],
        generator="human" if tier == "G0" else f"expand:{tier}",
        core_ids=core_ids,
    )


def test_g0_weighted_above_g2():
    scores = core_scores_from_report(
        {
            "cores": [
                {
                    "core_id": "anti_capture",
                    "label": "x",
                    "direction": "y",
                    "member_count": 5,
                    "members": ["a", "b", "c", "d", "e"],
                    "hit_count": 10,
                    "domains": ["law"],
                    "pair_hits": 2,
                    "member_source_hits": 5,
                    "score": 0.9,
                    "rank_weight": 0.9,
                }
            ]
        }
    )
    g0 = _pair("PP-G0", "G0", chosen="A gift that purchases the law is capture.")
    g2 = _pair("PP-G2", "G2", chosen="Hello only.")
    assert weight_for_pair(g0, scores) > weight_for_pair(g2, scores)


def test_expand_boosts_high_weight_ids():
    scores = core_scores_from_report(
        {
            "cores": [
                {
                    "core_id": "anti_capture",
                    "label": "x",
                    "direction": "y",
                    "member_count": 6,
                    "members": list("abcdef"),
                    "hit_count": 20,
                    "domains": [],
                    "pair_hits": 0,
                    "member_source_hits": 6,
                    "score": 1.0,
                    "rank_weight": 1.0,
                }
            ]
        }
    )
    pairs = [
        _pair(
            "GOLD",
            "G0",
            chosen="A gift that purchases the law is not alliance — it is capture.",
            core_ids=["anti_capture"],
        ),
        _pair("BULK1", "G2"),
        _pair("BULK2", "G2"),
        _pair("BULK3", "G2"),
        _pair("BULK4", "G2"),
    ]
    expanded = expand_for_weighted_training(
        pairs, core_scores=scores, target_n=40, seed=0, max_copies=8
    )
    from collections import Counter

    counts = Counter(p.pair_id for p in expanded)
    assert counts["GOLD"] >= counts["BULK1"]


def test_rows_have_sample_weight():
    pairs = [_pair("A", "G1"), _pair("B", "G3")]
    rows = pairs_to_weighted_rows(pairs, core_scores={}, expand=False)
    assert len(rows) == 2
    assert "sample_weight" in rows[0]
    assert rows[0]["prompt"]


def test_summarize():
    pairs = [_pair("A", "G0"), _pair("B", "G2")]
    s = summarize_weights(pairs, {})
    assert s.n == 2
    assert "G0" in s.by_tier
