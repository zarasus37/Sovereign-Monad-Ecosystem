"""GP-4 seeded expand."""
from __future__ import annotations

from gnosis_training.expand_g2 import expand_pair, expand_corpus
from gnosis_training.preference import pair_from_wire, validate_pair


def _seed_wire():
    return {
        "pair_id": "PP-001",
        "category": "CAT7",
        "prompt": "Why does density beat volume under predation?",
        "chosen": {
            "response": (
                "THEOLOGICAL LENS: Extraction wears the mask of opportunity.\n\n"
                "TECHNOLOGICAL LENS: Markout and toxic flow punish thin books.\n\n"
                "COSMOLOGICAL LENS: Predation ecology recurs across venues.\n\n"
                "LOGIC COMPRESSION: Keep fail-closed density gates."
            ),
            "scores": {
                "tripartite": 0.9,
                "logic_compress": 0.9,
                "source_aligned": 0.9,
                "epistemic": 0.9,
                "no_rlhf_signal": 0.9,
                "total": 0.9,
            },
            "notes": "seed",
        },
        "rejected": {
            "response": "Just chase volume and fees.",
            "scores": {
                "tripartite": 0.5,
                "logic_compress": 0.5,
                "source_aligned": 0.5,
                "epistemic": 0.5,
                "no_rlhf_signal": 0.5,
                "total": 0.5,
            },
            "notes": "thin",
        },
        "failing_criteria": ["C1"],
        "apeiron": False,
        "bootstrap": False,
        "constitution_version": "v2.0",
        "synthetic": False,
        "provenance_tier": "G0",
        "generator": "human",
    }


def test_expand_pair_emits_valid_g2():
    seed = pair_from_wire(_seed_wire())
    out = expand_pair(seed, max_variants=4)
    assert len(out) >= 1
    for p in out:
        assert p.provenance_tier == "G2"
        assert p.seed_pair_ids == ["PP-001"]
        assert p.pair_id.startswith("PP-G2-")
        assert validate_pair(p) == []


def test_expand_corpus_filter_category():
    seed = pair_from_wire(_seed_wire())
    out = expand_corpus([seed], variants_per_seed=2, categories={"CAT1"})
    assert out == []
    out2 = expand_corpus([seed], variants_per_seed=2, categories={"CAT7"})
    assert len(out2) == 2
