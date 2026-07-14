"""dataset.py — JSONL→datasets adapter (CPU-pure-ish; ``datasets`` import-gated)."""
from __future__ import annotations

import json

import pytest

from gnosis_training.dataset import (
    build_completion_only_labels,
    filter_passed,
    passes_gate,
    read_events_jsonl,
    to_chat_messages,
    to_hf_rows,
)


def _event_wire(passes: bool, total: float = 0.95) -> dict:
    return {
        "event_id": f"a1b2c3d4-1111-5111-8111-11111111111{int(passes)}",
        "constitution_version": "v1",
        "wheel_state": {"A": {"offset": 0, "key_hash": "k0"}},
        "active_slots": {
            "theology": {"wheel": "A", "slot": "A", "label": None},
            "technology": {"wheel": "S", "slot": "B", "label": None},
            "cosmology": {"wheel": "X", "slot": "C", "label": None},
        },
        "provenance_tokens": ["reg:A:0"],
        "messages": [
            {"role": "system", "content": "LOGOC"},
            {"role": "user", "content": "What is entropy?"},
            {"role": "assistant", "content": ""},
        ],
        "constitution_score": {
            "tripartite": 1.0, "logic_compress": 0.9, "source_aligned": 1.0,
            "epistemic": 0.8, "no_rlhf_signal": 1.0, "total": total, "passes": passes,
        },
    }


def _write_jsonl(path, wires):
    path.write_text("\n".join(json.dumps(w) for w in wires) + "\n", encoding="utf-8")


def test_read_events_jsonl_parses_lines(tmp_path):
    """read_events_jsonl returns typed GnosisEvent objects (CPU-pure, no datasets)."""
    p = tmp_path / "events.jsonl"
    _write_jsonl(p, [_event_wire(True), _event_wire(False, total=0.60)])
    events = read_events_jsonl(p)
    assert len(events) == 2
    assert events[0].event_id.startswith("a1b2")


def test_passes_gate_drops_failing_events():
    """The SFT inclusion gate (concretization, spec lines 172+294) drops events
    where constitution_score.passes is False."""
    events = read_events_jsonl_via_wires([_event_wire(True), _event_wire(False, total=0.60)])
    passed = filter_passed(events)
    assert len(passed) == 1
    assert passed[0].constitution_score.passes is True


def read_events_jsonl_via_wires(wires):
    """Helper mirroring read_events_jsonl but from in-memory wires (no disk)."""
    from gnosis_training.event import from_wire

    return [from_wire(w) for w in wires]


def test_passes_gate_requires_structural_validity_too():
    """passes_gate ANDs the passes flag with structural validity."""
    from gnosis_training.event import from_wire

    wire = _event_wire(True)
    wire["messages"] = [{"role": "system", "content": "x"}]  # wrong message count
    event = from_wire(wire)
    assert passes_gate(event) is False


def test_to_chat_messages_preserves_roles():
    """to_chat_messages projects messages to HF chat {role, content} shape."""
    events = read_events_jsonl_via_wires([_event_wire(True)])
    msgs = to_chat_messages(events[0])
    assert [m["role"] for m in msgs] == ["system", "user", "assistant"]


def test_to_hf_rows_shape_for_sft_trainer():
    """to_hf_rows produces the row shape an SFTTrainer (chat template) expects."""
    events = read_events_jsonl_via_wires([_event_wire(True)])
    rows = to_hf_rows(events)
    assert rows[0].keys() == {"messages", "event_id", "total"}


def test_build_completion_only_labels_masks_prompt():
    """Assistant loss-masking: tokens before the prompt boundary are -100
    (PyTorch's ignore index); the completion tokens remain."""
    input_ids = list(range(20))
    prompt_len = 7
    labels = build_completion_only_labels(input_ids, prompt_len)
    assert labels[:prompt_len] == [-100] * prompt_len
    assert labels[prompt_len:] == input_ids[prompt_len:]


def test_build_completion_only_labels_is_torch_free():
    """The mask helper operates on plain int lists (no torch) — unit-testable
    without the ML stack."""
    labels = build_completion_only_labels([1, 2, 3, 4], prompt_len=2, ignore_index=-100)
    assert labels == [-100, -100, 3, 4]


# ── datasets-backed path (skips if `datasets` not installed) ────────────────

def test_load_gnosis_dataset_applies_passes_gate():
    """Integration: load_gnosis_dataset returns a datasets.Dataset with only
    passing events. Skips if `datasets` isn't installed locally."""
    pytest.importorskip("datasets")
    from gnosis_training.dataset import load_gnosis_dataset

    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as fh:
        for passes in (True, False, True):
            fh.write(json.dumps(_event_wire(passes)) + "\n")
        path = fh.name
    ds = load_gnosis_dataset(path, apply_passes_gate=True)
    assert ds.num_rows == 2  # the two passing events
    assert all(row["total"] >= 0.72 for row in ds)