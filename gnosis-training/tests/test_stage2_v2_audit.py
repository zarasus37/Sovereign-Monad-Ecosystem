"""CPU-pure Stage 2 v2 audit — does not load models or touch CUDA."""
from __future__ import annotations

from pathlib import Path

from gnosis_training.stage2_v2 import STAGE2_DEFAULT_CORPUS, audit_corpus


def test_audit_reports_worksheet_as_bootstrap_scaffold():
    # Paths relative to gnosis-training package cwd in pytest
    audit = audit_corpus(
        worksheet_path=Path("data/preference_pairs_worksheet.jsonl"),
        trainable_path=Path("data/preference_pairs_ALL.jsonl"),
    )
    assert audit.claimed_worksheet_total == 250
    assert audit.claimed_worksheet_ok == 0
    assert audit.claimed_worksheet_pending == 250
    assert audit.trainable_ok >= 40  # human-judged ALL file
    assert "CAT1" in audit.trainable_cats
    assert "CAT9" in audit.cats_missing
    assert any("bootstrap worksheet" in n.lower() or "scaffold" in n.lower() for n in audit.honesty_notes)
    md = audit.to_markdown()
    assert "Pre-Train Audit" in md
    assert str(audit.trainable_ok) in md


def test_default_corpus_path_is_all_not_worksheet():
    assert STAGE2_DEFAULT_CORPUS.name == "preference_pairs_ALL.jsonl"
