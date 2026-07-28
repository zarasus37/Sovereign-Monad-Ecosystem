"""Core Resonance Score + Council source loading."""
from __future__ import annotations

from pathlib import Path

from gnosis_training.core_resonance import (
    CORE_CATALOG,
    match_cores_in_text,
    score_cores,
    collect_hits_from_pairs,
    CoreHit,
    train_sample_weight,
    analyze_core_resonance,
    pair_core_boost,
)
from gnosis_training.council_sources import (
    default_councile_dir,
    load_members,
    generator_member_id,
)


def test_catalog_nonempty():
    assert len(CORE_CATALOG) >= 10
    ids = [c.core_id for c in CORE_CATALOG]
    assert len(ids) == len(set(ids))


def test_match_freedom_in_constraint():
    text = "Authentic freedom is skilled motion inside constraint envelopes."
    hits = match_cores_in_text(text)
    assert "freedom_in_constraint" in hits


def test_match_anti_capture():
    text = "A gift that purchases the law is not alliance — it is capture."
    hits = match_cores_in_text(text)
    assert "anti_capture" in hits


def test_score_prioritizes_multi_member():
    hits = [
        CoreHit("freedom_in_constraint", "marcus-aurelius", "member:a", "x"),
        CoreHit("freedom_in_constraint", "spinoza", "member:b", "y"),
        CoreHit("freedom_in_constraint", "alan-watts", "member:c", "z"),
        CoreHit("decision_not_outcome", "sun-tzu", "member:d", "w"),
    ]
    scores = score_cores(hits, total_members=40)
    by = {s.core_id: s for s in scores}
    assert by["freedom_in_constraint"].member_count == 3
    assert by["freedom_in_constraint"].score > by["decision_not_outcome"].score
    assert by["freedom_in_constraint"].score > 0.5


def test_generator_member_id():
    assert generator_member_id("council:sun-tzu") == "sun-tzu"
    assert generator_member_id("human") is None


def test_pair_hits_and_weights():
    pairs = [
        {
            "pair_id": "PP-1",
            "provenance_tier": "G1",
            "generator": "council:llull",
            "prompt": "x",
            "chosen": {
                "response": "Constraint generates possibility under real limits.",
                "scores": {"total": 0.9},
            },
            "core_ids": ["constraint_generates"],
        },
        {
            "pair_id": "PP-2",
            "provenance_tier": "G2",
            "generator": "expand:v1",
            "prompt": "y",
            "chosen": {"response": "Hello world only.", "scores": {"total": 0.8}},
        },
    ]
    hits = collect_hits_from_pairs(pairs)
    assert any(h.core_id == "constraint_generates" for h in hits)
    scores = {s.core_id: s for s in score_cores(hits, total_members=10)}
    w1 = train_sample_weight(pairs[0], scores)
    w2 = train_sample_weight(pairs[1], scores)
    assert w1 > w2  # G1 + core boost > G2 bare


def test_load_council_registry():
    root = default_councile_dir()
    if not (root / "council-registry.json").is_file():
        return  # skip if corpus not present in env
    members = load_members(root, load_bodies=False)
    assert len(members) >= 20
    assert all(m.member_id for m in members)
    assert any(m.key_insight for m in members)


def test_analyze_runs_without_pairs(tmp_path: Path):
    root = default_councile_dir()
    if not (root / "council-registry.json").is_file():
        return
    report = analyze_core_resonance(
        pairs_path=None,
        councile_dir=root,
        include_pairs=False,
        include_members=True,
    )
    assert report["member_count"] >= 20
    assert len(report["cores"]) == len(CORE_CATALOG)
