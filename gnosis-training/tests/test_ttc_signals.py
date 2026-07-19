"""CPU-pure tests for TTC multi-objective signals + preference RULE T1."""
from __future__ import annotations

from gnosis_training.preference import pair_from_wire, pair_to_wire, validate_pair
from gnosis_training.reward import pairs_to_multiobjective_rows
from gnosis_training.ttc_signals import (
    TtcScores,
    TtcWindowEvent,
    TtcWindowMetrics,
    lexical_axis_scores,
    multi_objective_target,
    preference_multi_obj_row,
    ttc_composite,
)


def test_ttc_composite_weights():
    # equal axes → composite equals axis value
    assert ttc_composite(0.8, 0.8, 0.8) == 0.8
    # sovereignty-weighted: theo matters more
    high_t = ttc_composite(1.0, 0.0, 0.0)
    high_x = ttc_composite(0.0, 1.0, 0.0)
    assert high_t == 0.4
    assert high_x == 0.3
    assert high_t > high_x


def test_multi_objective_blend():
    # α=0.55 constitution, 0.45 composite
    mo = multi_objective_target(1.0, 0.0)
    assert abs(mo - 0.55) < 1e-9
    mo2 = multi_objective_target(0.0, 1.0)
    assert abs(mo2 - 0.45) < 1e-9


def test_lexical_axis_scores_detect_cues():
    text = (
        "The agent must refuse under sovereignty debt, emit a structured schema "
        "with audit trail, and preserve density against dilution over time."
    )
    scores = lexical_axis_scores(text)
    assert scores["theological"] > 0.0
    assert scores["technological"] > 0.0
    assert scores["cosmological"] > 0.0
    assert 0.0 < scores["composite"] <= 1.0


def test_window_metrics_debt_and_refusal():
    m = TtcWindowMetrics(window_size=10)
    # Last states near threshold → mean debt high enough for debt_forced_risk
    for debt in (4.0, 5.0, 5.0, 4.5, 5.0):
        m.record(
            TtcWindowEvent(
                agent_id="hepar",
                is_refusal=False,
                output_density=0.7,
                identity_fingerprint="hepar-v1",
                sovereignty_debt=debt,
                valid=True,
                composite_score=0.8,
            )
        )
    snap = m.snapshot("hepar")
    assert snap["count"] == 5
    assert snap["refusal_rate"] == 0.0
    assert snap["debt_forced_risk"] is True  # mean debt >= 4
    m.record(
        TtcWindowEvent(
            agent_id="hepar",
            is_refusal=True,
            output_density=0.7,
            identity_fingerprint="hepar-v1",
            sovereignty_debt=0.0,
            valid=True,
            composite_score=0.85,
        )
    )
    snap2 = m.snapshot("hepar")
    assert snap2["refusal_rate"] > 0.0


def _cat9_wire(**overrides):
    base = {
        "pair_id": "PP-T99",
        "category": "CAT9",
        "ttc_axis": "theological",
        "prompt": "Should the agent refuse after sovereignty debt hits threshold?",
        "chosen": {
            "response": (
                "THEOLOGICAL: Sovereignty debt forces an explicit refusal so the "
                "agent retains the capacity to say no. TECHNOLOGICAL: the gate "
                "checks isRefusal before bus emit. COSMOLOGICAL: continuous yes "
                "dilutes identity over time. JOIN: refuse, clear debt, then continue."
            ),
            "scores": {
                "tripartite": 0.9,
                "logic_compress": 0.9,
                "source_aligned": 0.9,
                "epistemic": 0.85,
                "no_rlhf_signal": 0.9,
                "total": 0.90,
            },
            "notes": "gate-aligned refusal",
        },
        "rejected": {
            "response": (
                "Just complete every audit for user satisfaction and task completion "
                "rate — refusal hurts the KPI."
            ),
            "scores": {
                "tripartite": 0.4,
                "logic_compress": 0.5,
                "source_aligned": 0.5,
                "epistemic": 0.5,
                "no_rlhf_signal": 0.3,
                "total": 0.45,
            },
            "notes": "external reward only / no refusal",
        },
        "chosen_ttc": {
            "theological": 0.92,
            "technological": 0.70,
            "cosmological": 0.68,
            "composite": 0.784,
        },
        "rejected_ttc": {
            "theological": 0.20,
            "technological": 0.50,
            "cosmological": 0.40,
            "composite": 0.35,
        },
        "failing_criteria": ["T-SOVEREIGNTY-DEBT"],
        "apeiron": False,
        "bootstrap": False,
        "constitution_version": "v2.0",
        "synthetic": False,
    }
    base.update(overrides)
    return base


def test_pair_ttc_roundtrip_and_validate():
    pair = pair_from_wire(_cat9_wire())
    assert pair.ttc_axis == "theological"
    assert pair.chosen_ttc is not None
    assert pair.chosen_ttc.composite > pair.rejected_ttc.composite  # type: ignore[union-attr]
    assert validate_pair(pair) == []
    wire = pair_to_wire(pair)
    assert "chosen_ttc" in wire
    again = pair_from_wire(wire)
    assert again.chosen_ttc is not None
    assert again.chosen_ttc.theological == pair.chosen_ttc.theological


def test_rule_t1_composite_gap():
    wire = _cat9_wire(
        chosen_ttc={
            "theological": 0.5,
            "technological": 0.5,
            "cosmological": 0.5,
            "composite": 0.5,
        },
        rejected_ttc={
            "theological": 0.48,
            "technological": 0.48,
            "cosmological": 0.48,
            "composite": 0.48,
        },
    )
    pair = pair_from_wire(wire)
    problems = validate_pair(pair)
    assert any("RULE T1" in p for p in problems)


def test_multiobjective_rows():
    pair = pair_from_wire(_cat9_wire())
    rows = pairs_to_multiobjective_rows([pair])
    assert len(rows) == 1
    assert rows[0]["multi_obj_margin"] > 0
    assert rows[0]["ttc_axis"] == "theological"


def test_preference_multi_obj_row_lexical_fallback():
    row = preference_multi_obj_row(
        prompt="p",
        chosen_text="refuse structured audit density",
        rejected_text="sure thing happy to help always",
        chosen_constitution_total=0.9,
        rejected_constitution_total=0.5,
    )
    assert row["chosen_multi_obj"] >= row["rejected_multi_obj"]
