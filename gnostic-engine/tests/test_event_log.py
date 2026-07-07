"""
Tests for the durable JSONL event log + CHARTER §4 replay (Layer 5).

Coverage:
- JsonlEventLog append/read round-trip
- Crash recovery (a fresh EventLog on the same path reads back every event)
- Time-window filtering
- replay_chains reconstructs a 3-event intention chain via parentEventId links
- Events without a trace appear in the flat list but not in chains
- Routes integration: POST /gnosis/process with a trace persists a linked
  score→dove chain; GET /audit/replay reconstructs it
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from gnostic_engine.persistence import (
    JsonlEventLog,
    StoredEvent,
    replay_chains,
    replay_events,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def log(tmp_path: Path) -> JsonlEventLog:
    return JsonlEventLog(tmp_path / "events.jsonl")


def make_event(
    event_id: str,
    event_type: str,
    timestamp: str,
    sequence_number: int,
    *,
    trace: dict[str, Any] | None = None,
    payload: dict[str, Any] | None = None,
) -> StoredEvent:
    return StoredEvent(
        event_id=event_id,
        event_type=event_type,
        timestamp=timestamp,
        sequence_number=sequence_number,
        payload=payload or {"agent_id": "agent-x"},
        trace=trace,
    )


# ── EventLog unit tests ────────────────────────────────────────────────────────


def test_append_and_read_round_trip(log: JsonlEventLog) -> None:
    e = make_event("e-1", "gnosis.score.computed", "2026-07-06T10:00:00Z", 1)
    log.append(e)
    read = log.read()
    assert len(read) == 1
    assert read[0].event_id == "e-1"
    assert read[0].event_type == "gnosis.score.computed"
    assert read[0].sequence_number == 1
    # Wire shape is camelCase (matches @sovereign/types StoredEvent).
    with open(log.path, "r", encoding="utf-8") as f:
        line = json.loads(f.readline())
    assert set(line.keys()) == {"eventId", "eventType", "timestamp", "sequenceNumber", "payload"}


def test_trace_omitted_when_none(log: JsonlEventLog) -> None:
    e = make_event("e-1", "gnosis.score.computed", "2026-07-06T10:00:00Z", 1)
    log.append(e)
    with open(log.path, "r", encoding="utf-8") as f:
        line = json.loads(f.readline())
    assert "trace" not in line  # None trace is not serialized


def test_trace_present_when_set(log: JsonlEventLog) -> None:
    e = make_event(
        "e-1",
        "gnosis.score.computed",
        "2026-07-06T10:00:00Z",
        1,
        trace={"intentionId": "i-1", "source": "test"},
    )
    log.append(e)
    with open(log.path, "r", encoding="utf-8") as f:
        line = json.loads(f.readline())
    assert line["trace"] == {"intentionId": "i-1", "source": "test"}


def test_crash_recovery_reopen_log(tmp_path: Path) -> None:
    """A fresh EventLog on the same path reads back every prior event."""
    path = tmp_path / "events.jsonl"
    first = JsonlEventLog(path)
    first.append(make_event("e-1", "gnosis.score.computed", "2026-07-06T10:00:00Z", 1))
    first.append(make_event("e-2", "dove.signal.tier1", "2026-07-06T10:00:01Z", 2))

    # Simulate a restart: drop the in-memory object, reopen from disk.
    reopened = JsonlEventLog(path)
    read = reopened.read()
    assert [e.event_id for e in read] == ["e-1", "e-2"]


def test_time_window_filter(log: JsonlEventLog) -> None:
    log.append(make_event("e-1", "t", "2026-07-06T10:00:00Z", 1))
    log.append(make_event("e-2", "t", "2026-07-06T11:00:00Z", 2))
    log.append(make_event("e-3", "t", "2026-07-06T12:00:00Z", 3))

    in_window = log.read(from_ts="2026-07-06T10:30:00Z", to_ts="2026-07-06T11:30:00Z")
    assert [e.event_id for e in in_window] == ["e-2"]

    from_only = log.read(from_ts="2026-07-06T11:00:00Z")
    assert [e.event_id for e in from_only] == ["e-2", "e-3"]


def test_replay_yields_in_order(log: JsonlEventLog) -> None:
    log.append(make_event("e-1", "t", "2026-07-06T10:00:00Z", 1))
    log.append(make_event("e-2", "t", "2026-07-06T10:00:01Z", 2))
    seen = [e.event_id for e in log.replay()]
    assert seen == ["e-1", "e-2"]


# ── Replay chain reconstruction ─────────────────────────────────────────────────


def test_replay_reconstructs_chain_via_parent_event_id(log: JsonlEventLog) -> None:
    """A 3-event chain: constraint envelope → gnosis score → dove signal."""
    trace_root = {
        "intentionId": "i-1",
        "source": "risk-engine",
        "constraintEnvelopeId": "env-1",
    }
    e1 = make_event("e-1", "constraint.envelope.created", "2026-07-06T10:00:00Z", 1, trace=trace_root)
    e2 = make_event(
        "e-2",
        "gnosis.score.computed",
        "2026-07-06T10:00:01Z",
        2,
        trace={"intentionId": "i-1", "source": "risk-engine", "parentEventId": "e-1"},
    )
    e3 = make_event(
        "e-3",
        "dove.signal.tier2",
        "2026-07-06T10:00:02Z",
        3,
        trace={
            "intentionId": "i-1",
            "source": "risk-engine",
            "parentEventId": "e-2",
            "narrativePurposeId": "purpose-1",
        },
    )
    for e in (e1, e2, e3):
        log.append(e)

    chains = replay_chains(log)
    assert len(chains) == 1
    chain = chains[0]
    assert chain.intention_id == "i-1"
    assert chain.constraint_envelope_id == "env-1"
    assert chain.narrative_purpose_id == "purpose-1"
    assert chain.depth == 3
    # Ordered root → leaf via parentEventId links.
    assert [e.event_id for e in chain.events] == ["e-1", "e-2", "e-3"]


def test_events_without_trace_are_flat_only(log: JsonlEventLog) -> None:
    log.append(make_event("e-1", "gnosis.score.computed", "2026-07-06T10:00:00Z", 1))  # no trace
    log.append(
        make_event(
            "e-2",
            "dove.signal.tier1",
            "2026-07-06T10:00:01Z",
            2,
            trace={"intentionId": "i-9", "source": "s"},
        )
    )
    events = replay_events(log)
    assert {e.event_id for e in events} == {"e-1", "e-2"}
    chains = replay_chains(log)
    assert len(chains) == 1  # only the traced event forms a chain
    assert chains[0].intention_id == "i-9"
    assert chains[0].depth == 1


def test_replay_groups_multiple_intentions(log: JsonlEventLog) -> None:
    log.append(
        make_event("a-1", "t", "2026-07-06T10:00:00Z", 1, trace={"intentionId": "i-a", "source": "s"})
    )
    log.append(
        make_event("b-1", "t", "2026-07-06T10:00:01Z", 2, trace={"intentionId": "i-b", "source": "s"})
    )
    chains = replay_chains(log)
    assert {c.intention_id for c in chains} == {"i-a", "i-b"}


# ── Routes integration ──────────────────────────────────────────────────────────


@pytest.fixture
def client_with_isolated_log(tmp_path: Path):
    """TestClient with engine_state.event_log redirected to a temp file."""
    from api.gnostic_api import app  # noqa: WPS433 — imported lazily to apply the redirect
    from gnostic_engine.api import live_state

    original_log = live_state.engine_state.event_log
    live_state.engine_state.event_log = JsonlEventLog(tmp_path / "isolated.jsonl")
    # Clear the volatile ring buffers so counts start clean.
    live_state.engine_state._scores.clear()
    live_state.engine_state._dove_signals.clear()
    client = TestClient(app)
    yield client, live_state.engine_state
    live_state.engine_state.event_log = original_log
    live_state.engine_state._scores.clear()
    live_state.engine_state._dove_signals.clear()


def test_process_packet_persists_linked_chain(client_with_isolated_log) -> None:
    client, state = client_with_isolated_log
    trace = {
        "intentionId": "i-trace-1",
        "source": "test-suite",
        "constraintEnvelopeId": "env-test",
    }
    # w_host_ratio > 0.25 trips the Lane C kill-switch → MAGNITUDE_REJECT,
    # structural_read = 0.0 → overall_score < 0.65 → Tier 1 Dove signal fires.
    resp = client.post(
        "/api/v1/gnosis/process",
        json={
            "agent_id": "agent-isolated",
            "lane_a": 0.4,
            "lane_b": 0.2,
            "lane_c": 0.5,
            "v_mask": [True, False, True],
            "w_cong": True,
            "w_host_ratio": 0.5,
            "w_user_ratio": 0.1,
            "trace": trace,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["verdict"] == "MAGNITUDE_REJECT"
    assert body["trace"] == trace  # trace propagated to the returned score

    # Replay the durable log.
    replay = client.get("/api/v1/audit/replay").json()
    event_types = [e["eventType"] for e in replay["events"]]
    assert "gnosis.score.computed" in event_types
    assert "dove.signal.tier1" in event_types

    chains = replay["chains"]
    assert len(chains) == 1
    chain = chains[0]
    assert chain["intentionId"] == "i-trace-1"
    assert chain["constraintEnvelopeId"] == "env-test"
    assert chain["depth"] == 2  # score → dove
    ordered_ids = [e["eventId"] for e in chain["events"]]
    assert [e["eventType"] for e in chain["events"]] == [
        "gnosis.score.computed",
        "dove.signal.tier1",
    ]

    # The dove links back to the score via trace.parentEventId.
    score_event = chain["events"][0]
    dove_event = chain["events"][1]
    assert dove_event["trace"]["parentEventId"] == score_event["eventId"]
    assert score_event["trace"]["intentionId"] == "i-trace-1"


def test_audit_replay_time_window(client_with_isolated_log) -> None:
    client, _ = client_with_isolated_log
    client.post(
        "/api/v1/gnosis/process",
        json={
            "agent_id": "agent-window",
            "lane_a": 0.4,
            "lane_b": 0.2,
            "lane_c": 0.5,
            "w_host_ratio": 0.5,
            "trace": {"intentionId": "i-win", "source": "test-suite"},
        },
    )
    # Far-future upper bound excludes nothing; a past-from excludes everything.
    all_events = client.get("/api/v1/audit/replay?to=2999-01-01T00:00:00Z").json()
    assert len(all_events["events"]) >= 2
    empty = client.get("/api/v1/audit/replay?from=2999-01-01T00:00:00Z").json()
    assert empty["events"] == []