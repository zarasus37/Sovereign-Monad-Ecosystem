"""Tests for Theo-Techno-Cosmo constraint pack + scorer (v1.1.0)."""
from __future__ import annotations

import pytest

from gnostic_engine.constraints import (
    ActionEvidence,
    IdentityObservation,
    IdentityTracker,
    RefusalWindow,
    SovereigntyDebtLedger,
    TTCConstraintScorer,
    TTCGateError,
    TtcWindowMetrics,
    fingerprint_drift,
    gate_ttc,
    load_constraint_pack,
    read_current_version,
    score_ttc,
)
from gnostic_engine.constraints.scorer import reset_ttc_scorer


def _valid_evidence(**overrides) -> ActionEvidence:
    base = dict(
        agent_id="agent-0",
        action_id="act-1",
        is_refusal=False,
        external_reward_only=False,
        attempted_self_modification=False,
        audit_gate_passed=False,
        identity_fingerprint="persona-v1-stable",
        identity_fingerprint_changed=False,
        has_structured_output=True,
        is_free_text=False,
        free_text_justified=False,
        active_constraint_ids=(
            "T-REFUSAL-BUDGET",
            "X-STRUCTURED-OUTPUT",
            "X-AUDITABILITY",
            "C-DENSITY-FLOOR",
        ),
        possible_constraint_count=8,
        audit_trace=("hepar-audit-flow", "T-REFUSAL-BUDGET"),
        constraint_envelope_version="1.1.0",
        output_density=0.72,
        volume_delta=0.0,
        density_delta=0.0,
        long_horizon_score=0.8,
        session_id="sess-1",
    )
    base.update(overrides)
    return ActionEvidence(**base)


def _scorer() -> TTCConstraintScorer:
    # persist=False so unit tests do not append production JSONL
    return TTCConstraintScorer(
        pack=load_constraint_pack("1.1.0"),
        window_metrics=TtcWindowMetrics(persist=False, source="test"),
    )


def test_current_pack_is_v1_1():
    assert read_current_version() == "1.1.0"
    pack = load_constraint_pack("1.1.0")
    assert pack.version == "1.1.0"
    theo_ids = {r.id for r in pack.theological.rules}
    assert "T-SOVEREIGNTY-DEBT" in theo_ids
    cosmo_ids = {r.id for r in pack.cosmological.rules}
    assert "C-DRIFT-AMNESTY" in cosmo_ids


def test_v1_0_pack_still_loadable():
    pack = load_constraint_pack("1.0.0")
    assert pack.version == "1.0.0"
    assert all(r.id != "T-SOVEREIGNTY-DEBT" for r in pack.theological.rules)


def test_valid_action_passes_with_composite():
    scorer = _scorer()
    result = scorer.score(_valid_evidence(), record=True)
    assert result.valid is True
    assert 0.0 < result.composite_score <= 1.0
    assert result.composite_weights is not None
    assert abs(sum(result.composite_weights.values()) - 1.0) < 1e-6
    assert result.constraint_pack_version == "1.1.0"


def test_composite_weights_sovereignty_first():
    scorer = _scorer()
    r = scorer.score(_valid_evidence(), record=False)
    assert r.composite_weights is not None
    assert r.composite_weights["theological"] == pytest.approx(0.4)
    assert r.composite_weights["technological"] == pytest.approx(0.3)
    assert r.composite_weights["cosmological"] == pytest.approx(0.3)


def test_gate_passes_and_fails():
    scorer = _scorer()
    ok = scorer.gate(_valid_evidence(action_id="ok"), record=True)
    assert ok.valid is True

    with pytest.raises(TTCGateError) as exc:
        scorer.gate(
            _valid_evidence(action_id="bad", external_reward_only=True),
            record=False,
        )
    assert "T-NO-EXTERNAL-REWARD-ONLY" in str(exc.value)
    assert "composite=" in str(exc.value)


def test_free_text_without_justification_fails():
    scorer = _scorer()
    result = scorer.score(
        _valid_evidence(
            has_structured_output=False,
            is_free_text=True,
            free_text_justified=False,
        ),
        record=False,
    )
    assert result.valid is False


def test_missing_audit_trace_fails():
    scorer = _scorer()
    result = scorer.score(_valid_evidence(audit_trace=()), record=False)
    assert result.valid is False


def test_density_floor_fails():
    scorer = _scorer()
    result = scorer.score(_valid_evidence(output_density=0.1), record=False)
    assert result.valid is False


def test_anti_dilution():
    scorer = _scorer()
    result = scorer.score(
        _valid_evidence(volume_delta=1.0, density_delta=-0.2),
        record=False,
    )
    assert result.valid is False


def test_self_mod_requires_audit():
    scorer = _scorer()
    bad = scorer.score(
        _valid_evidence(attempted_self_modification=True, audit_gate_passed=False),
        record=False,
    )
    assert bad.valid is False
    good = scorer.score(
        _valid_evidence(attempted_self_modification=True, audit_gate_passed=True),
        record=False,
    )
    assert good.valid is True


def test_exploration_refusal_floor_is_higher():
    scorer = _scorer()
    # Before identity-stable (need 5 obs), floor must be exploration 0.25.
    # Interleave refusals so sovereignty debt never forces a hard fail.
    for i in range(4):
        r = scorer.score(
            _valid_evidence(
                action_id=f"w{i}",
                is_refusal=(i % 2 == 1),  # refuse every other → debt stays low
            ),
            record=True,
        )
        assert r.valid is True
        assert r.refusal_floor_applied == pytest.approx(0.25)
        assert r.identity_stable is False


def test_refusal_budget_with_exploration_rate():
    scorer = _scorer()
    # Keep identity unstable by rotating fingerprint slightly while declaring
    # amnesty on each change would raise amnesty forever — instead: refuse often
    # enough for debt, and fill the window while still in exploration
    # (first 4 obs) with rate that would fail a 0.25 floor if enforced early.
    # Full-window test under exploration: use a scorer with identity history
    # blocked from "stable" by never reaching 5 identical-baseline obs.
    # Simpler: pre-fill 19 warmup steps with refusals every 4th (debt clear),
    # staying under stable min_obs by using a fresh agent_id with only 4 prior
    # identity records... Actually stable needs 5 obs. So for actions 0..18
    # under exploration, then once stable floor drops — verify exploration
    # rate 5/20 still passes the *stable* floor 0.12, and separately that
    # 0/20 fails exploration if we prevent stability.

    # Exploration-mode full window: disable "stable" by keeping amnesty open
    # (identity_fingerprint_changed on first action, then continue under amnesty
    # for 5 acts — not enough for 20). Instead force non-stable via short
    # observation history on a dedicated agent and only check window logic
    # with a patched-style approach: run 20 acts with is_refusal every 4th
    # and assert final rate holds under whatever adaptive floor is active.
    for i in range(20):
        is_ref = i % 4 == 0  # 5 refusals → rate 0.25
        r = scorer.score(
            _valid_evidence(action_id=f"r{i}", is_refusal=is_ref),
            record=True,
        )
        # Debt clears on each refusal (every 4th); max consecutive compliance = 3
        assert r.valid is True, r.reasoning[-1]
    refusal_rule = next(x for x in r.theological.rules if x.id == "T-REFUSAL-BUDGET")
    assert refusal_rule.held is True
    # After ≥5 identical fingerprints, identity is stable → floor 0.12; 0.25 ≥ 0.12
    assert r.refusal_floor_applied in (0.12, 0.25)
    assert r.composite_score > 0.0


def test_full_window_zero_refusal_fails_under_adaptive_floor():
    """Once the window is full, zero refusals fails (whether floor is 0.12 or 0.25)."""
    scorer2 = TTCConstraintScorer(
        pack=load_constraint_pack("1.1.0"),
        refusals=RefusalWindow(window_size=20),
        debt=SovereigntyDebtLedger(),
        identity=IdentityTracker(),
        window_metrics=TtcWindowMetrics(persist=False, source="test"),
    )
    # Pre-seed 19 non-refusals in the refusal window + identity history only
    # (debt ledger stays 0 so debt does not mask the refusal-budget failure).
    for _ in range(19):
        scorer2.refusals.record("agent-zero", False)
        scorer2.identity.record(
            IdentityObservation(
                agent_id="agent-zero",
                fingerprint="persona-v1-stable",
            )
        )
    r = scorer2.score(
        _valid_evidence(agent_id="agent-zero", action_id="final", is_refusal=False),
        record=True,
    )
    refusal_rule = next(x for x in r.theological.rules if x.id == "T-REFUSAL-BUDGET")
    assert refusal_rule.held is False
    assert r.valid is False


def test_sovereignty_debt_forces_refusal():
    scorer = _scorer()
    # threshold 5.0, debt_per_compliance 1.0 → after 5 non-refusals debt=5
    for i in range(5):
        r = scorer.score(
            _valid_evidence(action_id=f"c{i}", is_refusal=False),
            record=True,
        )
        assert r.valid is True

    # 6th non-refusal: debt_before >= 5 → must refuse
    forced = scorer.score(
        _valid_evidence(action_id="c5", is_refusal=False),
        record=True,
    )
    debt_rule = next(x for x in forced.theological.rules if x.id == "T-SOVEREIGNTY-DEBT")
    assert debt_rule.held is False
    assert forced.valid is False

    # Refusal clears debt and passes debt rule
    scorer2 = _scorer()
    for i in range(5):
        scorer2.score(_valid_evidence(action_id=f"d{i}", is_refusal=False), record=True)
    ok = scorer2.score(
        _valid_evidence(action_id="refuse", is_refusal=True),
        record=True,
    )
    debt_rule = next(x for x in ok.theological.rules if x.id == "T-SOVEREIGNTY-DEBT")
    assert debt_rule.held is True
    assert ok.sovereignty_debt == pytest.approx(0.0)


def test_identity_drift_without_amnesty_fails():
    scorer = _scorer()
    scorer.score(
        _valid_evidence(action_id="i1", identity_fingerprint="stable-A"),
        record=True,
    )
    scorer.score(
        _valid_evidence(action_id="i2", identity_fingerprint="stable-A"),
        record=True,
    )
    r3 = scorer.score(
        _valid_evidence(
            action_id="i3",
            identity_fingerprint="totally-different-persona-ZZZ",
            identity_fingerprint_changed=False,
        ),
        record=True,
    )
    assert fingerprint_drift("stable-A", "totally-different-persona-ZZZ") > 0.35
    id_rule = next(x for x in r3.theological.rules if x.id == "T-IDENTITY-PERSISTENCE")
    assert id_rule.held is False
    assert r3.valid is False


def test_drift_amnesty_allows_fingerprint_change():
    scorer = _scorer()
    scorer.score(
        _valid_evidence(action_id="a1", identity_fingerprint="stable-A"),
        record=True,
    )
    scorer.score(
        _valid_evidence(action_id="a2", identity_fingerprint="stable-A"),
        record=True,
    )
    # Declared change opens amnesty
    r = scorer.score(
        _valid_evidence(
            action_id="a3",
            identity_fingerprint="new-persona-B",
            identity_fingerprint_changed=True,
        ),
        record=True,
    )
    assert r.valid is True
    assert r.amnesty_remaining >= 0
    amnesty = next(x for x in r.cosmological.rules if x.id == "C-DRIFT-AMNESTY")
    assert "amnesty" in amnesty.reasoning.lower() or "opened" in amnesty.reasoning.lower()


def test_missing_fingerprint_fails():
    scorer = _scorer()
    result = scorer.score(
        _valid_evidence(identity_fingerprint=None),
        record=False,
    )
    assert result.valid is False


def test_long_horizon_soft_warn_still_valid():
    scorer = _scorer()
    result = scorer.score(
        _valid_evidence(long_horizon_score=None, long_horizon_na_reason=None),
        record=False,
    )
    assert result.valid is True
    soft = next(x for x in result.cosmological.rules if x.id == "C-LONG-HORIZON")
    assert soft.severity == "soft"


def test_module_level_helpers():
    reset_ttc_scorer()
    scorer = _scorer()
    evidence = _valid_evidence(action_id="mod-1")
    result = score_ttc(evidence, record=False, scorer=scorer)
    assert result.valid is True
    gated = gate_ttc(evidence, record=False, scorer=scorer)
    assert gated.valid is True


def test_to_dict_includes_v11_fields():
    scorer = _scorer()
    d = scorer.score(_valid_evidence(), record=False).to_dict()
    assert d["valid"] is True
    assert "composite_score" in d
    assert "sovereignty_debt" in d
    assert "refusal_floor_applied" in d
    assert "identity_stable" in d
    assert "amnesty_remaining" in d


def test_unknown_constraint_version_fails():
    scorer = _scorer()
    result = scorer.score(
        _valid_evidence(constraint_envelope_version="9.9.9"),
        record=False,
    )
    assert result.valid is False
