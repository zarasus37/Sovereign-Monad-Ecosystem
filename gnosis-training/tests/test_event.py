"""event.py — wire-shape round-trip + structural validation (CPU-pure)."""
from __future__ import annotations

import pytest

from gnosis_training.event import (
    GnosisEvent,
    from_wire,
    to_wire,
    validate_event,
)


def _sample_event(assistant_content: str = "") -> dict:
    return {
        "event_id": "a1b2c3d4-1111-5111-8111-111111111111",
        "constitution_version": "v1",
        "wheel_state": {
            "A": {"offset": 0, "key_hash": "k0"},
            "S": {"offset": 1, "key_hash": "k1"},
        },
        "active_slots": {
            "theology": {"wheel": "A", "slot": "A", "label": None},
            "technology": {"wheel": "S", "slot": "B", "label": None},
            "cosmology": {"wheel": "X", "slot": "C", "label": None},
        },
        "provenance_tokens": ["reg:A:0", "reg:S:1"],
        "messages": [
            {"role": "system", "content": "LOGOC system prompt"},
            {"role": "user", "content": "What is entropy?"},
            {"role": "assistant", "content": assistant_content},
        ],
        "constitution_score": {
            "tripartite": 1.0,
            "logic_compress": 0.9,
            "source_aligned": 1.0,
            "epistemic": 0.8,
            "no_rlhf_signal": 1.0,
            "total": 0.95,
            "passes": True,
        },
    }


def test_from_wire_to_wire_roundtrip_preserves_shape():
    """from_wire then to_wire is identity on the wire shape (snake_case)."""
    wire = _sample_event(assistant_content="THEOLOGICAL LENS: ...")
    event: GnosisEvent = from_wire(wire)
    back = to_wire(event)
    assert back == wire


def test_label_null_roundtrips_as_none_not_string():
    """The Catalan-labels data asset is absent → label stays None, not 'None'."""
    event = from_wire(_sample_event())
    assert event.active_slots["theology"].label is None
    assert to_wire(event)["active_slots"]["theology"]["label"] is None


def test_assistant_content_default_empty_in_feedstock():
    """The data-gen producer emits the assistant target empty — the mirror
    preserves that as an empty string, never fabricated."""
    event = from_wire(_sample_event(assistant_content=""))
    assert event.messages[2].role == "assistant"
    assert event.messages[2].content == ""


def test_validate_event_clean_for_valid_event():
    """A well-formed event has no structural problems."""
    event = from_wire(_sample_event())
    assert validate_event(event) == []


def test_validate_event_flags_wrong_message_roles():
    """The scaffold must be system/user/assistant in order."""
    wire = _sample_event()
    wire["messages"] = [
        {"role": "system", "content": "x"},
        {"role": "assistant", "content": "y"},
        {"role": "user", "content": "z"},
    ]
    event = from_wire(wire)
    problems = validate_event(event)
    assert any("roles" in p for p in problems)


def test_validate_event_flags_missing_domain():
    """All three TTCL domains must be present in active_slots."""
    wire = _sample_event()
    del wire["active_slots"]["cosmology"]
    event = from_wire(wire)
    problems = validate_event(event)
    assert any("cosmology" in p for p in problems)


def test_validate_event_flags_out_of_range_score():
    """constitution_score criteria must lie in [0, 1]."""
    wire = _sample_event()
    wire["constitution_score"]["total"] = 1.5
    event = from_wire(wire)
    problems = validate_event(event)
    assert any("total" in p for p in problems)


def test_from_wire_raises_on_missing_key():
    """from_wire is a parser, not a validator — missing keys raise KeyError."""
    wire = _sample_event()
    del wire["event_id"]
    with pytest.raises(KeyError):
        from_wire(wire)