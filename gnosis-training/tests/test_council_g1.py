"""Member-true Council G1 generator."""
from __future__ import annotations

from gnosis_training.council_g1 import build_member_true_pairs, write_g1_jsonl
from gnosis_training.council_sources import default_councile_dir
from gnosis_training.preference import validate_pair


def test_member_true_pairs_validate(tmp_path):
    root = default_councile_dir()
    if not (root / "council-registry.json").is_file():
        return
    pairs = build_member_true_pairs(root, max_members=5, modes=("insight", "contrast"))
    assert len(pairs) == 10  # 5 members × 2 modes
    for p in pairs:
        assert p.provenance_tier == "G1"
        assert p.generator and p.generator.startswith("council:")
        assert p.chosen.response
        assert member_name_in_response(p)
        problems = validate_pair(p)
        assert problems == [], (p.pair_id, problems)

    out = tmp_path / "g1.jsonl"
    summary = write_g1_jsonl(pairs, out)
    assert summary["wrote"] == 10
    assert summary["invalid"] == 0
    assert out.is_file()
    text = out.read_text(encoding="utf-8")
    assert "KEY INSIGHT:" in text
    assert "core_ids" in text or "PP-CG1-" in text


def member_name_in_response(p) -> bool:
    # generator council:x should appear in notes or window tag
    mid = p.generator.split(":", 1)[1]
    return mid.replace("-", " ") in p.chosen.response.lower() or mid in p.chosen.notes
