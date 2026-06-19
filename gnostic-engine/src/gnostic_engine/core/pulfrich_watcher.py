"""
PulfrichWatcher

Implements Pulfrich phase tilt (temporal parallax) for 4D volumetric analysis.
"""

from __future__ import annotations
import time
from typing import Dict, List, Tuple
import numpy as np


class PulfrichWatcher:
    """
    Tracks temporal phase differences between two channels.
    Used to detect Pulfrich-like effects in data streams.
    """

    def __init__(self, channel_a: str = "A", channel_b: str = "B"):
        self.channel_a = channel_a
        self.channel_b = channel_b
        self.history: Dict[str, List[Tuple[float, float]]] = {
            channel_a: [],
            channel_b: []
        }

    def record(self, channel: str, value: float, timestamp: float | None = None) -> None:
        ts = timestamp or time.time()
        self.history.setdefault(channel, []).append((ts, value))
        if len(self.history[channel]) > 20:
            self.history[channel].pop(0)

    def track(self, channel: str, value: float, timestamp: float | None = None) -> None:
        self.record(channel, value, timestamp)

    def get_elliptical_parallax(self, var_id: str) -> float:
        history = self.history.get(var_id, [])
        if len(history) < 2:
            return 0.0

        discovery_now = history[-1][1]
        verification_delayed = history[-2][1]

        if verification_delayed == 0:
            return 0.0

        phase_tilt = np.arctan2(discovery_now, verification_delayed)
        return float(np.round(np.degrees(phase_tilt), 2))

    def phase_tilt(self, window: int = 10) -> float:
        """Calculate approximate phase tilt (temporal offset) between channels."""
        a = self.history.get(self.channel_a, [])[-window:]
        b = self.history.get(self.channel_b, [])[-window:]

        if len(a) < 2 or len(b) < 2:
            return 0.0

        vals_a = np.array([v for _, v in a])
        vals_b = np.array([v for _, v in b])

        # Simple cross-correlation based lag estimation
        lag = np.argmax(np.correlate(vals_a - vals_a.mean(),
                                     vals_b - vals_b.mean(), mode='full')) - (len(vals_a) - 1)
        return float(lag)