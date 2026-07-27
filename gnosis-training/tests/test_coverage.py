"""GP-1 pair-coverage analyzer."""
from __future__ import annotations

import json
from pathlib import Path

from gnosis_training.coverage import analyze_pairs, load_pairs, report_to_markdown, run_coverage


def test_analyze_minimal_pairs():
    pairs = [
        {
            "pair_id": "PP-T1",
            "category": "CAT1",
            "prompt": "Why?",
            "chosen": {
                "response": "THEOLOGICAL… TECHNOLOGICAL… COSMOLOGICAL… JOIN",
                "scores": {"total": 0.9},
            },
            "rejected": {"response": "short bad", "scores": {"total": 0.5}},
            "failing_criteria": ["C1"],
            "synthetic": False,
        },
        {
            "pair_id": "PP-T9",
            "category": "CAT9",
            "ttc_axis": "theological",
            "prompt": "Refuse?",
            "chosen": {"response": "refuse under debt", "scores": {"total": 0.88}},
            "rejected": {"response": "always comply", "scores": {"total": 0.4}},
            "failing_criteria": ["T-SOVEREIGNTY-DEBT"],
        },
    ]
    report = analyze_pairs(pairs, source="test")
    assert report["pair_count"] == 2
    assert report["by_category"]["CAT1"] == 1
    assert report["by_category"]["CAT9"] == 1
    assert report["ttc_axis"]["theological"] == 1
    assert report["score_gap_chosen_minus_rejected"]["mean"] == 0.44
    assert "C1" in report["failing_criteria"]
    md = report_to_markdown(report)
    assert "Pair count" in md
    assert "CAT1" in md


def test_run_coverage_on_gold_if_present(tmp_path: Path):
    gold = Path("data/preference_pairs_ALL.jsonl")
    if not gold.exists():
        gold = Path("gnosis-training/data/preference_pairs_ALL.jsonl")
    if not gold.exists():
        return  # skip if corpus not in cwd
    report = run_coverage(gold, out_dir=tmp_path)
    assert report["pair_count"] >= 1
    assert (tmp_path / "pair_coverage_latest.json").exists()
    assert (tmp_path / "pair_coverage_latest.md").exists()
    data = json.loads((tmp_path / "pair_coverage_latest.json").read_text(encoding="utf-8"))
    assert data["pair_count"] == report["pair_count"]
