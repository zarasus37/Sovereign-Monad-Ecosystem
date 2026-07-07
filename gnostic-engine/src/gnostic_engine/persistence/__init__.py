"""
Gnostic Engine persistence layer (Layer 5 — durable audit trail).

Append-only JSONL event store + CHARTER §4 intention-chain replay.
"""

from .event_log import (
    EventStore,
    JsonlEventLog,
    StoredEvent,
    build_event_log_from_env,
    new_event_id,
)
from .replay import DecisionChain, replay, replay_chains, replay_events

__all__ = [
    "EventStore",
    "JsonlEventLog",
    "StoredEvent",
    "build_event_log_from_env",
    "new_event_id",
    "DecisionChain",
    "replay",
    "replay_chains",
    "replay_events",
]