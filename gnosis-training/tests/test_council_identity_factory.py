"""Identity factory: parse events → valid G1 pairs."""
from __future__ import annotations

from gnosis_training.council_identity_factory import (
    ONBOARDING_MEMBER_IDS,
    build_identity_pairs,
    load_member_pack,
)
from gnosis_training.council_sources import default_councile_dir
from gnosis_training.preference import validate_pair


def test_llull_pack_has_events():
    root = default_councile_dir()
    if not (root / "council-registry.json").is_file():
        return
    pack = load_member_pack("ramon-llull", root)
    assert pack.char_count > 1000
    assert len(pack.events) >= 5
    assert pack.events[0].compressed


def test_onboarding_build_valid_pairs():
    root = default_councile_dir()
    if not (root / "council-registry.json").is_file():
        return
    # small subset for speed
    pairs, report = build_identity_pairs(
        ["ramon-llull", "alan-watts"],
        councile_dir=root,
        min_confidence=0.8,
        max_events_per_member=3,
    )
    assert len(pairs) >= 2
    for p in pairs:
        assert p.provenance_tier == "G1"
        assert p.generator and "identity-factory" in p.generator
        assert "SOURCE EVENT:" in p.chosen.response
        assert validate_pair(p) == []
    assert report["pair_count"] == len(pairs)


def test_onboarding_ids_count():
    assert len(ONBOARDING_MEMBER_IDS) == 11
