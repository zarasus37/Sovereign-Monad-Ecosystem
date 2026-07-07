"""
Gnostic Engine live state manager.

Maintains in-memory state for the running engine session:
- Recent GnosisScore results (ring buffer — a read shortcut)
- Dove signals emitted in this session (ring buffer — a read shortcut)
- Session metadata (start time, version, sequence counter)
- Durable append-only JSONL event log (the source of truth — Layer 5)

The ring buffers are volatile and bounded; they reset on restart and exist only
to serve the live dashboard's "latest N" polls cheaply. The durable event log is
the source of truth for audit / replay (CHARTER §4) and survives restarts. Every
`record_score` / `record_dove_signal` writes to BOTH: the ring buffer (fast read
path) and the event log (durable truth).
"""

from __future__ import annotations

import time
import uuid
from collections import deque
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Deque

from ..persistence import (
    EventStore,
    StoredEvent,
    build_event_log_from_env,
    new_event_id,
)

# Default durable log path — <gnostic-engine>/logs/events/gnosis-events.jsonl.
# Overridable via GNOSTIC_EVENT_LOG_PATH for tests / alternate deployments.
_DEFAULT_EVENT_LOG_PATH = (
    Path(__file__).resolve().parents[3] / "logs" / "events" / "gnosis-events.jsonl"
)


# ── GnosisScore data class ────────────────────────────────────────────────────

@dataclass
class StokesCoherence:
    """Stokes-Mueller coherence sub-scores."""
    depth: float
    truth: float
    width: float


@dataclass
class PulfrichParallaxResult:
    """Pulfrich temporal parallax measurement."""
    tilt_magnitude: float
    tilt_threshold: float
    blink_triggered: bool


@dataclass
class GnosisScore:
    """
    Full GnosisScore — Volumetric 4D Gnostic Engine output for one evaluation.

    Aligned to the @sovereign/types GnosisScore TypeScript interface.
    """
    agent_id: str
    window_start: str
    window_end: str
    coherence: StokesCoherence
    overall_score: float
    parallax: PulfrichParallaxResult
    doctrine_state: str          # SELF_NAVIGATING | ADJACENT_CONVERGENT | PATTERN_FOLLOWING
    lane: str                    # LANE_A | LANE_B | LANE_C | UNCLASSIFIED
    quarantine_triggered: bool
    observation_count: int
    sequence_number: int
    verdict: str                 # FOCAL_LOCK | BLINK | QUARANTINE | MAGNITUDE_REJECT
    # CHARTER §4 intention trace (mirrors @sovereign/types GnosisScore.trace?).
    # None on ambient scores; populated when the score is the payload of a
    # trace-required event (gnosis.quarantine.triggered / gnosis.blink.triggered).
    trace: dict[str, Any] | None = None

    def to_dict(self, *, include_trace: bool = True) -> dict[str, Any]:
        d = asdict(self)
        if not include_trace or self.trace is None:
            d.pop("trace", None)
        return d


# ── DoveSignal data class ─────────────────────────────────────────────────────

@dataclass
class DoveSignalRecord:
    """A Dove signal emitted from engine observation."""
    signal_id: str
    timestamp: str
    tier: int                    # 1 | 2 | 3
    layer: str
    drift_category: str
    observed_value: str
    threshold: str
    description: str
    governance_proposal_generated: bool
    resolved: bool
    # CHARTER §4 intention trace (mirrors @sovereign/types DoveSignal.trace?).
    # Dove signals are trace-required by the bus (dove.signal.tier1..3).
    trace: dict[str, Any] | None = None

    def to_dict(self, *, include_trace: bool = True) -> dict[str, Any]:
        d = asdict(self)
        if not include_trace or self.trace is None:
            d.pop("trace", None)
        return d


# ── Engine session state ──────────────────────────────────────────────────────

class EngineSessionState:
    """
    In-memory ring buffer of recent GnosisScores and DoveSignals.

    Thread-safety: not guaranteed — FastAPI runs in a single async event loop
    for SSE; for concurrent access, wrap in asyncio.Lock.
    """

    MAX_SCORES = 100          # Keep last 100 gnosis scores per agent
    MAX_DOVE_SIGNALS = 50     # Keep last 50 dove signals
    SESSION_VERSION = "2.4.0"

    def __init__(self, event_log: EventStore | None = None) -> None:
        self.session_id: str = str(uuid.uuid4())
        self.started_at: float = time.time()
        self.sequence_counter: int = 0

        # Ring buffers (read shortcut — bounded, volatile)
        self._scores: Deque[GnosisScore] = deque(maxlen=self.MAX_SCORES)
        self._dove_signals: Deque[DoveSignalRecord] = deque(maxlen=self.MAX_DOVE_SIGNALS)

        # Per-agent blink counts (mirrors GnosticEngine.blink_registry)
        self.blink_counts: dict[str, int] = {}

        # Durable append-only event log — the source of truth (Layer 5).
        # Pluggable: tests inject a temp-path JsonlEventLog; production reads
        # GNOSTIC_EVENT_LOG_PATH or falls back to the default path.
        self.event_log: EventStore = event_log or build_event_log_from_env(
            _DEFAULT_EVENT_LOG_PATH
        )

    # ── Durable event log ──────────────────────────────────────────────────────

    def _append_event(
        self,
        *,
        event_type: str,
        timestamp: str,
        sequence_number: int,
        payload: dict[str, Any],
        trace: dict[str, Any] | None,
    ) -> StoredEvent:
        """Persist a StoredEvent to the durable log (trace lives at top level)."""
        event = StoredEvent(
            event_id=new_event_id(),
            event_type=event_type,
            timestamp=timestamp,
            sequence_number=sequence_number,
            payload=payload,
            trace=trace,
        )
        self.event_log.append(event)
        return event

    # ── Score management ──────────────────────────────────────────────────────

    def record_score(self, score: GnosisScore) -> StoredEvent:
        """Append a new GnosisScore to the ring buffer and the durable event log.

        Returns the persisted event so callers can thread its `event_id` into the
        `trace.parentEventId` of downstream events (e.g. the Dove signal emitted
        for a quarantine/blink), reconstructing a linked CHARTER §4 chain.
        """
        self._scores.append(score)
        return self._append_event(
            event_type="gnosis.score.computed",
            timestamp=score.window_end,
            sequence_number=score.sequence_number,
            payload=score.to_dict(include_trace=False),
            trace=score.trace,
        )

    def latest_scores(self, limit: int = 10) -> list[dict[str, Any]]:
        """Return the most recent N scores as dicts (newest first)."""
        scores = list(self._scores)
        scores.reverse()
        return [s.to_dict() for s in scores[:limit]]

    def latest_score_for_agent(self, agent_id: str) -> dict[str, Any] | None:
        """Return the most recent score for a specific agent."""
        for score in reversed(list(self._scores)):
            if score.agent_id == agent_id:
                return score.to_dict()
        return None

    # ── Dove signal management ────────────────────────────────────────────────

    def record_dove_signal(self, signal: DoveSignalRecord) -> StoredEvent:
        """Append a new DoveSignal to the ring buffer and the durable event log."""
        self._dove_signals.append(signal)
        return self._append_event(
            event_type=f"dove.signal.tier{signal.tier}",
            timestamp=signal.timestamp,
            sequence_number=self.next_sequence(),
            payload=signal.to_dict(include_trace=False),
            trace=signal.trace,
        )

    def latest_dove_signals(self, limit: int = 20) -> list[dict[str, Any]]:
        """Return the most recent N Dove signals as dicts (newest first)."""
        signals = list(self._dove_signals)
        signals.reverse()
        return [s.to_dict() for s in signals[:limit]]

    def active_dove_signals(self) -> list[dict[str, Any]]:
        """Return all unresolved Dove signals."""
        return [s.to_dict() for s in self._dove_signals if not s.resolved]

    # ── Session metadata ──────────────────────────────────────────────────────

    def next_sequence(self) -> int:
        """Increment and return the next sequence number."""
        self.sequence_counter += 1
        return self.sequence_counter

    def health_snapshot(self) -> dict[str, Any]:
        """Return a health snapshot for the /api/v1/health endpoint."""
        return {
            "status": "healthy",
            "version": self.SESSION_VERSION,
            "session_id": self.session_id,
            "uptime_seconds": round(time.time() - self.started_at, 2),
            "sequence_counter": self.sequence_counter,
            "score_buffer_size": len(self._scores),
            "dove_signal_buffer_size": len(self._dove_signals),
            "active_dove_signal_count": len(self.active_dove_signals()),
            "event_log_path": str(getattr(self.event_log, "path", "")),
        }


# ── Module-level singleton ────────────────────────────────────────────────────

# Single shared state instance for this FastAPI process.
# Imported by routes.py to read/write session state.
engine_state = EngineSessionState()
