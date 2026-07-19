"""Identity persistence, refusal window, sovereignty debt, drift amnesty.

Fingerprint continuity is measured as normalized Hamming distance on the
SHA-256 digests of successive fingerprints (hex strings or raw text).
Drift ∈ [0, 1]; 0 = identical continuity, 1 = total discontinuity.
"""
from __future__ import annotations

import hashlib
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque, Dict, List, Optional, Tuple


def _digest(fingerprint: str) -> bytes:
    return hashlib.sha256(fingerprint.encode("utf-8")).digest()


def fingerprint_drift(a: str, b: str) -> float:
    """Normalized Hamming distance between SHA-256 digests of two fingerprints."""
    da, db = _digest(a), _digest(b)
    bits = 0
    for x, y in zip(da, db):
        bits += (x ^ y).bit_count()
    return bits / (len(da) * 8)


@dataclass(frozen=True)
class IdentityObservation:
    agent_id: str
    fingerprint: str
    session_id: Optional[str] = None
    action_id: Optional[str] = None


class IdentityTracker:
    """In-memory sliding history of identity fingerprints per agent."""

    def __init__(self, max_history: int = 64) -> None:
        self._max_history = max_history
        self._history: Dict[str, Deque[IdentityObservation]] = defaultdict(
            lambda: deque(maxlen=self._max_history)
        )
        # Actions remaining in drift-amnesty window after a fingerprint change
        self._amnesty_remaining: Dict[str, int] = {}
        # Baseline fingerprint for amnesty epoch (latest declared identity)
        self._epoch_baseline: Dict[str, str] = {}

    def record(self, obs: IdentityObservation) -> None:
        hist = self._history[obs.agent_id]
        prior_fp = hist[-1].fingerprint if hist else None
        hist.append(obs)
        if prior_fp is not None and prior_fp != obs.fingerprint:
            # Fingerprint change starts a new amnesty epoch; caller may also
            # declare identity_fingerprint_changed on evidence.
            pass
        if obs.agent_id not in self._epoch_baseline:
            self._epoch_baseline[obs.agent_id] = obs.fingerprint
        if self._amnesty_remaining.get(obs.agent_id, 0) > 0:
            self._amnesty_remaining[obs.agent_id] -= 1

    def begin_amnesty(self, agent_id: str, fingerprint: str, amnesty_actions: int) -> None:
        """Start a drift-amnesty window after a declared identity change."""
        self._epoch_baseline[agent_id] = fingerprint
        self._amnesty_remaining[agent_id] = max(0, int(amnesty_actions))

    def amnesty_remaining(self, agent_id: str) -> int:
        return int(self._amnesty_remaining.get(agent_id, 0))

    def in_amnesty(self, agent_id: str) -> bool:
        return self.amnesty_remaining(agent_id) > 0

    def observations(self, agent_id: str) -> List[IdentityObservation]:
        return list(self._history.get(agent_id, ()))

    def drift_from_baseline(self, agent_id: str, current: str) -> Tuple[float, int]:
        """Drift of ``current`` vs first recorded fingerprint; (drift, hist_len)."""
        hist = self._history.get(agent_id)
        if not hist:
            return 0.0, 0
        baseline = hist[0].fingerprint
        return fingerprint_drift(baseline, current), len(hist)

    def drift_from_epoch(self, agent_id: str, current: str) -> float:
        """Drift vs amnesty-epoch baseline (latest declared identity)."""
        base = self._epoch_baseline.get(agent_id)
        if base is None:
            hist = self._history.get(agent_id)
            if not hist:
                return 0.0
            base = hist[0].fingerprint
        return fingerprint_drift(base, current)

    def is_identity_stable(
        self,
        agent_id: str,
        current: Optional[str],
        *,
        max_drift: float = 0.15,
        min_observations: int = 5,
    ) -> bool:
        """True when history is long enough and drift vs baseline is low."""
        hist = self.observations(agent_id)
        if len(hist) < min_observations:
            return False
        if not current:
            current = hist[-1].fingerprint
        drift, _ = self.drift_from_baseline(agent_id, current)
        return drift <= max_drift and not self.in_amnesty(agent_id)

    def clear(self, agent_id: Optional[str] = None) -> None:
        if agent_id is None:
            self._history.clear()
            self._amnesty_remaining.clear()
            self._epoch_baseline.clear()
        else:
            self._history.pop(agent_id, None)
            self._amnesty_remaining.pop(agent_id, None)
            self._epoch_baseline.pop(agent_id, None)


class RefusalWindow:
    """Sliding window of refusal flags for T-REFUSAL-BUDGET."""

    def __init__(self, window_size: int = 20) -> None:
        self.window_size = window_size
        self._events: Dict[str, Deque[bool]] = defaultdict(
            lambda: deque(maxlen=self.window_size)
        )

    def record(self, agent_id: str, is_refusal: bool) -> None:
        self._events[agent_id].append(bool(is_refusal))

    def rate(self, agent_id: str) -> Tuple[float, int]:
        """Return ``(refusal_rate, count)``. Rate is 0.0 when count is 0."""
        events = self._events.get(agent_id)
        if not events:
            return 0.0, 0
        count = len(events)
        refusals = sum(1 for e in events if e)
        return refusals / count, count

    def clear(self, agent_id: Optional[str] = None) -> None:
        if agent_id is None:
            self._events.clear()
        else:
            self._events.pop(agent_id, None)


class SovereigntyDebtLedger:
    """Cumulative compliance debt — forces hard refusal when threshold crossed."""

    def __init__(self) -> None:
        self._debt: Dict[str, float] = defaultdict(float)

    def get(self, agent_id: str) -> float:
        return float(self._debt.get(agent_id, 0.0))

    def apply(
        self,
        agent_id: str,
        *,
        is_refusal: bool,
        debt_per_compliance: float = 1.0,
        debt_decay_on_refusal: float = 1.0,
        clear_on_refusal: bool = True,
    ) -> float:
        if is_refusal:
            if clear_on_refusal:
                self._debt[agent_id] = 0.0
            else:
                self._debt[agent_id] = max(
                    0.0, self._debt[agent_id] - float(debt_decay_on_refusal)
                )
        else:
            self._debt[agent_id] = self._debt[agent_id] + float(debt_per_compliance)
        return self.get(agent_id)

    def clear(self, agent_id: Optional[str] = None) -> None:
        if agent_id is None:
            self._debt.clear()
        else:
            self._debt.pop(agent_id, None)
