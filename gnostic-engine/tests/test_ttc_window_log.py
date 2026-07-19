"""TTC window log — automatic debt/refusal pain recording."""
from __future__ import annotations

from pathlib import Path

from gnostic_engine.constraints import (
    ActionEvidence,
    TTCConstraintScorer,
    TtcWindowMetrics,
    load_constraint_pack,
)


def _evidence(**kw) -> ActionEvidence:
    base = dict(
        agent_id="hepar-defi-auditor",
        action_id="act-1",
        is_refusal=False,
        identity_fingerprint="hepar-v1.1.0",
        has_structured_output=True,
        active_constraint_ids=("T-REFUSAL-BUDGET", "X-AUDITABILITY", "C-DENSITY-FLOOR"),
        possible_constraint_count=8,
        audit_trace=("hepar-audit-flow",),
        constraint_envelope_version="1.1.0",
        output_density=0.72,
        long_horizon_score=0.7,
    )
    base.update(kw)
    return ActionEvidence(**base)


def test_window_metrics_records_pass_and_fail(tmp_path: Path):
    log = tmp_path / "hepar.jsonl"
    metrics = TtcWindowMetrics(window_size=20, log_path=log, persist=True, source="test")
    scorer = TTCConstraintScorer(
        pack=load_constraint_pack("1.1.0"),
        window_metrics=metrics,
    )

    # Valid path
    r1 = scorer.score(_evidence(action_id="a1", is_refusal=True), record=True)
    assert r1.valid is True
    snap = metrics.snapshot("hepar-defi-auditor")
    assert snap.count == 1
    assert snap.refusal_rate == 1.0
    assert log.is_file()
    lines = log.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    assert "sovereignty_debt" in lines[0]

    # Invalid path (free text) still recorded
    r2 = scorer.score(
        _evidence(
            action_id="a2",
            is_refusal=False,
            has_structured_output=False,
            is_free_text=True,
            free_text_justified=False,
        ),
        record=True,
    )
    assert r2.valid is False
    snap2 = metrics.snapshot("hepar-defi-auditor")
    assert snap2.count == 2
    assert snap2.reject_rate == 0.5
    assert "X-STRUCTURED-OUTPUT" in snap2.last_failed_rules
    lines2 = log.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines2) == 2


def test_window_load_jsonl(tmp_path: Path):
    log = tmp_path / "load.jsonl"
    m1 = TtcWindowMetrics(log_path=log, persist=True, source="test")
    scorer = TTCConstraintScorer(
        pack=load_constraint_pack("1.1.0"),
        window_metrics=m1,
    )
    scorer.score(_evidence(action_id="x1", is_refusal=True), record=True)
    scorer.score(_evidence(action_id="x2", is_refusal=False), record=True)

    m2 = TtcWindowMetrics(log_path=log, persist=False, source="test")
    n = m2.load_jsonl()
    assert n == 2
    snap = m2.snapshot("hepar-defi-auditor")
    assert snap.count == 2
