"""
Durable append-only JSONL event log (Layer 5).

The ring buffers in `live_state.EngineSessionState` are a *read shortcut*, not a
source of truth — they are volatile, bounded, and reset on restart. "Soul
forensics" (CHARTER §4 intention traceability) demands a durable, append-only,
crash-recoverable record of every consequential event the engine emits.

This module provides that record. One JSON line per event (grep-able, rotatable,
zero new dependencies), behind a pluggable `EventStore` protocol so a future
Postgres/SQLite backend slots in without touching callers.

Wire shape (`StoredEvent`) is camelCase to match `@sovereign/types` event.ts —
one shape across the Python and TypeScript runtimes.
"""

from __future__ import annotations

import json
import os
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterator, Protocol, Sequence, runtime_checkable


# ── Stored event ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class StoredEvent:
    """
    A single event persisted in the durable log.

    Field names are camelCase to match the `@sovereign/types` `StoredEvent`
    TypeScript interface — the JSON wire shape is identical across runtimes.
    """

    event_id: str
    event_type: str
    timestamp: str  # ISO-8601
    sequence_number: int
    payload: dict[str, Any]
    trace: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "eventId": self.event_id,
            "eventType": self.event_type,
            "timestamp": self.timestamp,
            "sequenceNumber": self.sequence_number,
            "payload": self.payload,
        }
        if self.trace is not None:
            d["trace"] = self.trace
        return d

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "StoredEvent":
        return cls(
            event_id=raw["eventId"],
            event_type=raw["eventType"],
            timestamp=raw["timestamp"],
            sequence_number=raw["sequenceNumber"],
            payload=raw["payload"],
            trace=raw.get("trace"),
        )


# ── EventStore protocol ───────────────────────────────────────────────────────


@runtime_checkable
class EventStore(Protocol):
    """Pluggable backend so a future Postgres/SQLite store slots in unchanged."""

    def append(self, event: StoredEvent) -> None:
        ...

    def read(
        self,
        from_ts: str | None = None,
        to_ts: str | None = None,
    ) -> list[StoredEvent]:
        ...


# ── Timestamp helper ──────────────────────────────────────────────────────────


def _parse_ts(value: str) -> datetime:
    """Parse an ISO-8601 timestamp to a timezone-aware datetime.

    Naive timestamps are assumed UTC. Raises `ValueError` on unparseable input so
    callers cannot silently drop events with malformed timestamps.
    """
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _in_range(ts: str, from_ts: str | None, to_ts: str | None) -> bool:
    if from_ts is not None and _parse_ts(ts) < _parse_ts(from_ts):
        return False
    if to_ts is not None and _parse_ts(ts) > _parse_ts(to_ts):
        return False
    return True


# ── JSONL backend ─────────────────────────────────────────────────────────────


class JsonlEventLog:
    """
    Append-only JSONL event store. Default `EventStore` backend.

    - One JSON object per line (stable, sort_keys, compact separators).
    - Thread-safe via a per-instance lock (FastAPI runs a single async loop, but
      the SSE generator and sync handlers can both append).
    - No filesystem side effects on construction — the parent directory is created
      lazily on first `append`, so importing this module in tests touches nothing.
    - Crash-recoverable: every event is flushed to its own line before append
      returns, so a reopened log reads back every event that was acknowledged.
    """

    def __init__(self, path: str | Path, *, fsync: bool = False) -> None:
        self._path = Path(path)
        self._fsync = fsync
        self._lock = threading.Lock()

    @property
    def path(self) -> Path:
        return self._path

    def append(self, event: StoredEvent) -> None:
        line = json.dumps(event.to_dict(), sort_keys=True, separators=(",", ":"))
        with self._lock:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            with open(self._path, "a", encoding="utf-8") as f:
                f.write(line + "\n")
                if self._fsync:
                    f.flush()
                    os.fsync(f.fileno())

    def read(
        self,
        from_ts: str | None = None,
        to_ts: str | None = None,
    ) -> list[StoredEvent]:
        if not self._path.exists():
            return []
        events: list[StoredEvent] = []
        with self._lock, open(self._path, "r", encoding="utf-8") as f:
            for lineno, raw in enumerate(f, start=1):
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    events.append(StoredEvent.from_dict(json.loads(raw)))
                except (json.JSONDecodeError, KeyError) as exc:
                    raise RuntimeError(
                        f"corrupt event log at {self._path}:{lineno}: {exc}"
                    ) from exc
        if from_ts is None and to_ts is None:
            return events
        return [e for e in events if _in_range(e.timestamp, from_ts, to_ts)]

    def replay(
        self,
        from_ts: str | None = None,
        to_ts: str | None = None,
        handler: Callable[[StoredEvent], None] | None = None,
    ) -> Iterator[StoredEvent]:
        """Yield stored events in the window, optionally invoking `handler` per event."""
        for event in self.read(from_ts, to_ts):
            if handler is not None:
                handler(event)
            yield event


# ── Factory ───────────────────────────────────────────────────────────────────


def build_event_log_from_env(default_path: str | Path) -> EventStore:
    """
    Construct the process-wide event log from `GNOSTIC_EVENT_LOG_PATH` if set,
    otherwise from `default_path`. Used by `live_state` for the module singleton.
    """
    path = os.environ.get("GNOSTIC_EVENT_LOG_PATH")
    fsync = os.environ.get("GNOSTIC_EVENT_LOG_FSYNC", "").lower() in {"1", "true", "yes"}
    return JsonlEventLog(path or default_path, fsync=fsync)


def new_event_id() -> str:
    """Generate a fresh event identifier (UUID v4)."""
    return str(uuid.uuid4())