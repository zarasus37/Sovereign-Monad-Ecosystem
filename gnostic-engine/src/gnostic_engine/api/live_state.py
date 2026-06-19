"""
Gnostic Engine live state manager.

Maintains in-memory state for the running engine session:
- Recent GnosisScore results (ring buffer)
- Dove signals emitted in this session
- Session metadata (start time, version, sequence counter)

This module is the single source of truth for the /api/v1/gnosis/* endpoints.
All state is volatile — resets on restart. Persistent storage is handled by
the JSONL event log (future Phase E).
"""

from __future__ import annotations

import time
import uuid
from collections import deque
from dataclasses import dataclass, field, asdict
from typing import Any, Deque


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

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


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

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


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

    def __init__(self) -> None:
        self.session_id: str = str(uuid.uuid4())
        self.started_at: float = time.time()
        self.sequence_counter: int = 0

        # Ring buffers
        self._scores: Deque[GnosisScore] = deque(maxlen=self.MAX_SCORES)
        self._dove_signals: Deque[DoveSignalRecord] = deque(maxlen=self.MAX_DOVE_SIGNALS)

        # Per-agent blink counts (mirrors GnosticEngine.blink_registry)
        self.blink_counts: dict[str, int] = {}

    # ── Score management ──────────────────────────────────────────────────────

    def record_score(self, score: GnosisScore) -> None:
        """Append a new GnosisScore to the ring buffer."""
        self._scores.append(score)

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

    def record_dove_signal(self, signal: DoveSignalRecord) -> None:
        """Append a new DoveSignal to the ring buffer."""
        self._dove_signals.append(signal)

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
        }


# ── Module-level singleton ────────────────────────────────────────────────────

# Single shared state instance for this FastAPI process.
# Imported by routes.py to read/write session state.
engine_state = EngineSessionState()
