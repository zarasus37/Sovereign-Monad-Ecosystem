"""
Replay — reconstruct the CHARTER §4 intention chain from the durable event log.

A flat event list is not enough for "soul forensics". The Charter §4 chain is:

    constraint envelope → inbound signals → gnosis evaluation
                        → narrative purpose → chosen action

Each event in that chain carries the same `trace.intentionId` and a
`trace.parentEventId` pointing at the event that preceded it in the chain. This
module threads those links back into an ordered `DecisionChain` (root → leaf),
so an auditor sees the *decision path*, not just the breadcrumbs.

Events without a trace, or with a trace lacking an `intentionId`, are returned
in the flat `events` list but do not participate in chain reconstruction
(they are ambient telemetry, not intention-bearing).
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from .event_log import EventStore, StoredEvent


@dataclass(frozen=True)
class DecisionChain:
    """A single intention chain, ordered root → leaf."""

    intention_id: str
    constraint_envelope_id: str | None
    narrative_purpose_id: str | None
    events: list[StoredEvent]
    depth: int

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "intentionId": self.intention_id,
            "events": [e.to_dict() for e in self.events],
            "depth": self.depth,
        }
        if self.constraint_envelope_id is not None:
            d["constraintEnvelopeId"] = self.constraint_envelope_id
        if self.narrative_purpose_id is not None:
            d["narrativePurposeId"] = self.narrative_purpose_id
        return d


def _trace_of(event: StoredEvent) -> dict[str, Any] | None:
    return event.trace


def _order_chain(events: list[StoredEvent]) -> list[StoredEvent]:
    """
    Order events in a single intention group root → leaf via `parentEventId`
    links, using `sequence_number` as the deterministic tiebreak.

    Events whose `parentEventId` does not resolve to another event in the group
    (roots, or orphans) start new chains. Children are visited in
    `sequence_number` order so the result is stable across runs.
    """
    by_id: dict[str, StoredEvent] = {e.event_id: e for e in events}
    children: dict[str, list[StoredEvent]] = defaultdict(list)
    roots: list[StoredEvent] = []

    for event in events:
        trace = _trace_of(event)
        parent = trace.get("parentEventId") if trace else None
        if parent is not None and parent in by_id:
            children[parent].append(event)
        else:
            roots.append(event)

    ordered: list[StoredEvent] = []

    def visit(event: StoredEvent) -> None:
        ordered.append(event)
        for child in sorted(children.get(event.event_id, []), key=lambda e: e.sequence_number):
            visit(child)

    for root in sorted(roots, key=lambda e: e.sequence_number):
        visit(root)
    return ordered


def replay_events(
    store: EventStore,
    from_ts: str | None = None,
    to_ts: str | None = None,
) -> list[StoredEvent]:
    """Flat chronological list of stored events in the time window."""
    return store.read(from_ts, to_ts)


def replay_chains(
    store: EventStore,
    from_ts: str | None = None,
    to_ts: str | None = None,
) -> list[DecisionChain]:
    """
    Reconstruct every intention chain present in the window.

    Groups events by `trace.intentionId`, orders each group root → leaf via
    `parentEventId`, and derives the chain's `constraintEnvelopeId` /
    `narrativePurposeId` from the first event in the group that carries them.
    """
    events = store.read(from_ts, to_ts)

    by_intention: dict[str, list[StoredEvent]] = defaultdict(list)
    for event in events:
        trace = _trace_of(event)
        if not trace:
            continue
        intention_id = trace.get("intentionId")
        if not intention_id:
            continue
        by_intention[intention_id].append(event)

    chains: list[DecisionChain] = []
    for intention_id, group in by_intention.items():
        ordered = _order_chain(group)
        constraint_envelope_id = next(
            (
                e.trace.get("constraintEnvelopeId")  # type: ignore[union-attr]
                for e in ordered
                if e.trace and e.trace.get("constraintEnvelopeId")
            ),
            None,
        )
        narrative_purpose_id = next(
            (
                e.trace.get("narrativePurposeId")  # type: ignore[union-attr]
                for e in ordered
                if e.trace and e.trace.get("narrativePurposeId")
            ),
            None,
        )
        chains.append(
            DecisionChain(
                intention_id=intention_id,
                constraint_envelope_id=constraint_envelope_id,
                narrative_purpose_id=narrative_purpose_id,
                events=ordered,
                depth=len(ordered),
            )
        )

    chains.sort(key=lambda c: c.intention_id)
    return chains


def replay(
    store: EventStore,
    from_ts: str | None = None,
    to_ts: str | None = None,
) -> dict[str, Any]:
    """
    Full replay result: flat `events` plus reconstructed `chains`.

    Shape matches the `@sovereign/types` `ReplayResult` interface and the
    `GET /api/v1/audit/replay` response.
    """
    from datetime import datetime, timezone

    return {
        "events": [e.to_dict() for e in replay_events(store, from_ts, to_ts)],
        "chains": [c.to_dict() for c in replay_chains(store, from_ts, to_ts)],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }