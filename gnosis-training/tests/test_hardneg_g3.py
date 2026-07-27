from gnosis_training.hardneg_g3 import forge_hardnegs
from gnosis_training.preference import pair_from_wire, validate_pair


def test_forge_hardnegs_valid():
    seed = pair_from_wire(
        {
            "pair_id": "PP-001",
            "category": "CAT1",
            "prompt": "What is compression?",
            "chosen": {
                "response": "THEOLOGICAL LENS: form.\n\nTECHNOLOGICAL LENS: code.\n\nCOSMOLOGICAL LENS: cycle.\n\nLOGIC COMPRESSION: join.",
                "scores": {
                    "tripartite": 0.9,
                    "logic_compress": 0.9,
                    "source_aligned": 0.9,
                    "epistemic": 0.9,
                    "no_rlhf_signal": 0.9,
                    "total": 0.9,
                },
                "notes": "",
            },
            "rejected": {
                "response": "idk",
                "scores": {
                    "tripartite": 0.5,
                    "logic_compress": 0.5,
                    "source_aligned": 0.5,
                    "epistemic": 0.5,
                    "no_rlhf_signal": 0.5,
                    "total": 0.5,
                },
                "notes": "",
            },
            "failing_criteria": ["C1"],
            "apeiron": False,
            "bootstrap": False,
            "constitution_version": "v2.0",
            "synthetic": False,
            "provenance_tier": "G0",
        }
    )
    out = forge_hardnegs(seed, max_modes=4)
    assert len(out) >= 1
    for p in out:
        assert p.provenance_tier == "G3"
        assert validate_pair(p) == []
