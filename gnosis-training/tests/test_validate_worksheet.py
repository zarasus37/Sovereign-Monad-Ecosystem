"""cli.validate_worksheet — the human authoring gate (CPU-pure). The validator
checks an in-progress worksheet: bootstrap=True rows are "pending authoring"
(counted, not failed), bootstrap=False rows are validated against the real
quality-control rules. Exits non-zero if any authored row is invalid.
"""
from __future__ import annotations

import json

from gnosis_training.cli import validate_worksheet


def _write_pairs(path, wires):
    path.write_text("\n".join(json.dumps(w) for w in wires) + "\n", encoding="utf-8")


def _human_pair_wire(pair_id="PP-001", gap=0.30, chosen_total=0.95):
    rejected_total = chosen_total - gap
    return {
        "pair_id": pair_id,
        "category": "CAT1",
        "prompt": "What is entropy?",
        "chosen": {
            "response": "THEOLOGICAL LENS: ... LOGIC COMPRESSION: ...",
            "scores": {"tripartite": 1.0, "logic_compress": 0.9,
                       "source_aligned": 1.0, "epistemic": 0.8,
                       "no_rlhf_signal": 1.0, "total": chosen_total},
            "notes": "passes all criteria",
        },
        "rejected": {
            "response": "entropy is disorder",
            "scores": {"tripartite": 0.3, "logic_compress": 0.8,
                       "source_aligned": 1.0, "epistemic": 0.8,
                       "no_rlhf_signal": 1.0, "total": rejected_total},
            "notes": "missing cosmology",
        },
        "failing_criteria": ["C1"],
        "apeiron": False,
        "bootstrap": False,
        "constitution_version": "v2.0",
    }


def _bootstrap_pair_wire(pair_id="BOOT-0001"):
    # bootstrap=True, empty responses — the scaffold (mirror build_bootstrap_worksheet)
    return {
        "pair_id": pair_id,
        "category": "CAT1",
        "prompt": "What is entropy?",
        "chosen": {
            "response": "",
            "scores": {"tripartite": 1.0, "logic_compress": 0.9,
                       "source_aligned": 1.0, "epistemic": 0.8,
                       "no_rlhf_signal": 1.0, "total": 0.94},
            "notes": "bootstrap: pre-filled",
        },
        "rejected": {
            "response": "",
            "scores": {"tripartite": 0.3, "logic_compress": 0.9,
                       "source_aligned": 1.0, "epistemic": 0.8,
                       "no_rlhf_signal": 1.0, "total": 0.78},
            "notes": "bootstrap: degraded",
        },
        "failing_criteria": ["C1"],
        "apeiron": False,
        "bootstrap": True,
        "constitution_version": "v1",
    }


def test_empty_worksheet_reports_zero(tmp_path, capsys):
    p = tmp_path / "empty.jsonl"
    p.write_text("", encoding="utf-8")
    code = validate_worksheet(str(p))
    out = capsys.readouterr().out
    assert code == 0
    assert "0 ok, 0 pending authoring, 0 invalid" in out


def test_all_pending_worksheet_counts_bootstrap_not_invalid(tmp_path, capsys):
    """A fresh scaffold (all bootstrap=True) reports pending, NOT invalid, and
    exits 0 — the human just hasn't authored yet."""
    p = tmp_path / "worksheet.jsonl"
    _write_pairs(p, [_bootstrap_pair_wire(f"BOOT-{i:04d}") for i in range(5)])
    code = validate_worksheet(str(p))
    out = capsys.readouterr().out
    assert code == 0
    assert "0 ok, 5 pending authoring, 0 invalid" in out
    assert "no authored" in out


def test_authored_valid_pairs_report_ok(tmp_path, capsys):
    p = tmp_path / "worksheet.jsonl"
    _write_pairs(p, [_human_pair_wire(f"PP-{i:03d}") for i in range(3)])
    code = validate_worksheet(str(p))
    out = capsys.readouterr().out
    assert code == 0
    assert "3 ok, 0 pending authoring, 0 invalid" in out
    assert "ready for reward training" in out


def test_mixed_worksheet_reports_each_class(tmp_path, capsys):
    p = tmp_path / "worksheet.jsonl"
    _write_pairs(p, [
        _bootstrap_pair_wire("BOOT-0001"),   # pending
        _human_pair_wire("PP-001"),          # ok
        _human_pair_wire("PP-002"),          # ok
    ])
    code = validate_worksheet(str(p))
    out = capsys.readouterr().out
    assert code == 0
    assert "2 ok, 1 pending authoring, 0 invalid" in out


def test_invalid_authored_pair_fails_exit(tmp_path, capsys):
    """An authored (bootstrap=False) pair with too-small a gap is INVALID and the
    validator exits non-zero (gates reward training)."""
    bad = _human_pair_wire("PP-009", gap=0.02)  # gap < PREFERENCE_MIN_SCORE_GAP (0.15)
    p = tmp_path / "worksheet.jsonl"
    _write_pairs(p, [bad])
    code = validate_worksheet(str(p))
    out = capsys.readouterr().out
    assert code == 1
    assert "INVALID  PP-009" in out
    assert "1 invalid" in out


def test_invalid_among_valid_is_reported(tmp_path, capsys):
    p = tmp_path / "worksheet.jsonl"
    _write_pairs(p, [
        _human_pair_wire("PP-001"),                       # ok
        _human_pair_wire("PP-009", gap=0.02),              # invalid (gap)
        _bootstrap_pair_wire("BOOT-0001"),                # pending
    ])
    code = validate_worksheet(str(p))
    out = capsys.readouterr().out
    assert code == 1
    assert "INVALID  PP-009" in out
    assert "1 ok, 1 pending authoring, 1 invalid" in out