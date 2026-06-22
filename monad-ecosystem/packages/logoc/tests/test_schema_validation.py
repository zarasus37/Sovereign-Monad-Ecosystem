"""
Schema validation and integrity tests for LOGOC Event v5.2.
Ensures the Pydantic models, JSON schema, and migration rules are consistent.
"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from pydantic import ValidationError

from peirce.models import LogocEvent, PeirceSignature, SemioticFlags


def _valid_peirce_signature(**overrides) -> dict:
    """Return a baseline valid PeirceSignature dict for v5.2."""
    base = {
        "mode": "SYMBOL",
        "sign_class_id": 42,
        "sign_class_label": "Legisign-Symbol-Argument",
        "path": ["Legisign", "Symbol", "Argument"],
        "firstness_weight": 0.15,
        "secondness_weight": 0.35,
        "thirdness_weight": 0.50,
        "pragmatism_band": "FORMAL_THOUGHT",
    }
    base.update(overrides)
    return base


def _valid_event(**overrides) -> dict:
    """Return a baseline valid LogocEvent dict for v5.2."""
    base = {
        "schema_version": "LOGOC-Event-v5.2",
        "event_id": "evt_001",
        "timestamp": "2026-06-19T00:00:00Z",
        "narrative": "A rule-based argument.",
        "semiotic_flags": SemioticFlags(rule_based=True, convention=True, reason=True),
        "peirce": PeirceSignature(**_valid_peirce_signature()),
    }
    base.update(overrides)
    return base


# ------------------------------------------------------------------
# 1. Positive validation — complete v5.2 event
# ------------------------------------------------------------------

def test_valid_v5_2_event_passes():
    """A fully populated v5.2 event must instantiate without errors."""
    event = LogocEvent(**_valid_event())
    assert event.schema_version == "LOGOC-Event-v5.2"
    assert event.peirce is not None
    assert event.peirce.sign_class_id == 42


# ------------------------------------------------------------------
# 2. Negative validation — missing mandatory fields
# ------------------------------------------------------------------

def test_missing_event_id_fails():
    """event_id is mandatory at all schema versions."""
    with pytest.raises(ValidationError) as exc_info:
        LogocEvent(**_valid_event(event_id=None))
    assert "event_id" in str(exc_info.value)


def test_missing_timestamp_fails():
    """timestamp is mandatory at all schema versions."""
    with pytest.raises(ValidationError) as exc_info:
        LogocEvent(**_valid_event(timestamp=None))
    assert "timestamp" in str(exc_info.value)


def test_missing_narrative_fails():
    """narrative is mandatory at all schema versions."""
    with pytest.raises(ValidationError) as exc_info:
        LogocEvent(**_valid_event(narrative=None))
    assert "narrative" in str(exc_info.value)


# ------------------------------------------------------------------
# 3. Peirce block invariants
# ------------------------------------------------------------------

def test_peirce_weights_must_sum_to_one():
    """Pydantic model enforces weight-sum == 1.0 (within epsilon)."""
    with pytest.raises(ValidationError) as exc_info:
        PeirceSignature(
            mode="SYMBOL",
            sign_class_id=42,
            sign_class_label="Legisign-Symbol-Argument",
            path=["Legisign", "Symbol", "Argument"],
            firstness_weight=0.5,
            secondness_weight=0.5,
            thirdness_weight=0.5,  # sum = 1.5
            pragmatism_band="FORMAL_THOUGHT",
        )
    assert "sum to 1.0" in str(exc_info.value)


def test_peirce_sign_class_id_out_of_range():
    """sign_class_id must be in [0, 65]."""
    with pytest.raises(ValidationError) as exc_info:
        PeirceSignature(
            mode="SYMBOL",
            sign_class_id=66,
            sign_class_label="Invalid",
            path=["Legisign", "Symbol", "Argument"],
            firstness_weight=0.15,
            secondness_weight=0.35,
            thirdness_weight=0.50,
            pragmatism_band="FORMAL_THOUGHT",
        )
    assert "sign_class_id" in str(exc_info.value)


def test_peirce_sign_class_id_negative():
    """sign_class_id must be non-negative."""
    with pytest.raises(ValidationError) as exc_info:
        PeirceSignature(
            mode="SYMBOL",
            sign_class_id=-1,
            sign_class_label="Invalid",
            path=["Legisign", "Symbol", "Argument"],
            firstness_weight=0.15,
            secondness_weight=0.35,
            thirdness_weight=0.50,
            pragmatism_band="FORMAL_THOUGHT",
        )
    assert "sign_class_id" in str(exc_info.value)


# ------------------------------------------------------------------
# 4. Migration semantics — v5.1 → v5.2
# ------------------------------------------------------------------

def test_v5_1_event_without_peirce_is_valid():
    """v5.1 events may lack a Peirce block; the model allows it via default."""
    event = LogocEvent(
        schema_version="LOGOC-Event-v5.1",
        event_id="legacy_001",
        timestamp="2026-06-19T00:00:00Z",
        narrative="Legacy event with no Peirce classification.",
    )
    assert event.peirce is None
    assert event.peirce_migration_pending is False  # default, not yet classified


def test_v5_2_event_with_peirce_migration_pending_is_valid():
    """A v5.2 event may omit peirce IF peirce_migration_pending is True."""
    event = LogocEvent(
        schema_version="LOGOC-Event-v5.2",
        event_id="pending_001",
        timestamp="2026-06-19T00:00:00Z",
        narrative="Unclassifiable event.",
        peirce_migration_pending=True,
        peirce_migration_source="heuristic_v1_pending",
    )
    assert event.peirce is None
    assert event.peirce_migration_pending is True


def test_v5_2_event_without_peirce_and_not_pending_is_suspicious():
    """A v5.2 event without peirce AND without migration_pending is a schema violation.

    The Pydantic model does not enforce this at construction time (peirce is optional
    in the model to support migration), but the semantic contract says: either
    provide peirce OR set peirce_migration_pending=True.  This test documents the
    policy and can be promoted to a hard validation rule in a future schema revision.
    """
    event = LogocEvent(
        schema_version="LOGOC-Event-v5.2",
        event_id="bad_001",
        timestamp="2026-06-19T00:00:00Z",
        narrative="Missing peirce block without migration flag.",
        peirce=None,
        peirce_migration_pending=False,
    )
    # At the model level this is currently allowed for backward compat.
    # A strict validator would reject this.
    assert event.peirce is None
    assert event.peirce_migration_pending is False


# ------------------------------------------------------------------
# 5. JSON schema file integrity
# ------------------------------------------------------------------

def test_json_schema_file_is_valid_json():
    """spec/schema_v5.2.json must be parseable JSON."""
    schema_path = Path(__file__).parent.parent / "spec" / "schema_v5.2.json"
    raw = schema_path.read_text(encoding="utf-8")
    schema = json.loads(raw)
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["title"] == "LOGOC Event Schema v5.2"


def test_json_schema_covers_all_peirce_fields():
    """The JSON schema must declare all PeirceSignature fields."""
    schema_path = Path(__file__).parent.parent / "spec" / "schema_v5.2.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    peirce_props = schema["properties"]["peirce"]["properties"]
    required = set(schema["properties"]["peirce"]["required"])
    expected = {
        "mode",
        "sign_class_id",
        "sign_class_label",
        "path",
        "firstness_weight",
        "secondness_weight",
        "thirdness_weight",
        "pragmatism_band",
    }
    assert required == expected, f"Missing/extra fields: {expected.symmetric_difference(required)}"
    for field in expected:
        assert field in peirce_props, f"Field '{field}' not in schema peirce.properties"


def test_json_schema_includes_migration_fields():
    """The JSON schema must include peirce_migration_pending and peirce_migration_source."""
    schema_path = Path(__file__).parent.parent / "spec" / "schema_v5.2.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    assert "peirce_migration_pending" in schema["properties"]
    assert "peirce_migration_source" in schema["properties"]


# ------------------------------------------------------------------
# 6. Round-trip serialization
# ------------------------------------------------------------------

def test_event_round_trips_through_json():
    """Serialize → deserialize must yield an equivalent object."""
    original = LogocEvent(**_valid_event())
    json_str = original.model_dump_json()
    deserialized = LogocEvent.model_validate_json(json_str)
    assert deserialized.event_id == original.event_id
    assert deserialized.peirce.sign_class_id == original.peirce.sign_class_id
    assert deserialized.peirce.firstness_weight == original.peirce.firstness_weight


def test_migration_event_round_trips():
    """Migration-pending events must round-trip without peirce block."""
    original = LogocEvent(
        schema_version="LOGOC-Event-v5.2",
        event_id="rt_001",
        timestamp="2026-06-19T00:00:00Z",
        narrative="Round-trip test.",
        peirce_migration_pending=True,
        peirce_migration_source="heuristic_v1_pending",
    )
    json_str = original.model_dump_json()
    deserialized = LogocEvent.model_validate_json(json_str)
    assert deserialized.peirce_migration_pending is True
    assert deserialized.peirce_migration_source == "heuristic_v1_pending"
    assert deserialized.peirce is None
