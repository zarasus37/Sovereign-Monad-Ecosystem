#!/usr/bin/env python3
"""
semiotic_drift.py — Antikythera Observability Layer for Peirce Class Distributions

Logs semiotic class distributions per cycle alongside drift metrics,
detecting corpus-level shifts (e.g., sliding toward raw icons) as early
signals before they appear in outcome metrics.

Design:
- Each cycle produces a SemioticDistributionSnapshot (66-class histogram + band histogram)
- Consecutive snapshots are compared via KL divergence and chi-squared
- Drift patterns are classified: ICON_SURGE, INDEX_ATROPHY, FORMAL_THOUGHT_DECLINE, etc.
- Output is Antikythera-compatible: DriftObservation + AnomalyRecord
"""
from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple
from pathlib import Path

from peirce.manifold import get_manifold, PeirceManifold
from peirce.models import LogocEvent


# ── Drift thresholds (aligned with Antikythera 0.72 authenticity floor) ──────────

SEMIOTIC_DRIFT_THRESHOLD = 0.28   # Same as SYSTEMATIC_DRIFT threshold
SEMIOTIC_ANOMALY_THRESHOLD = 0.72  # Same as ANOMALOUS_DEVIATION threshold
MIN_SAMPLE_SIZE = 3               # Minimum events per cycle for valid distribution


# ── Data structures ─────────────────────────────────────────────────────────────

@dataclass
class SemioticDistributionSnapshot:
    """Histogram of Peirce classes in a single cycle."""
    cycle_id: str
    timestamp: float
    total_events: int
    accepted_events: int
    pending_events: int

    # 66-class histogram: class_id → count
    class_histogram: Dict[int, int] = field(default_factory=dict)

    # Band histogram
    band_histogram: Dict[str, int] = field(default_factory=dict)

    # Mode histogram (ICON, INDEX, SYMBOL)
    mode_histogram: Dict[str, int] = field(default_factory=dict)

    # Vehicle histogram (Qualisign, Sinsign, Legisign)
    vehicle_histogram: Dict[str, int] = field(default_factory=dict)

    # Object-relation histogram (Icon, Index, Symbol)
    object_histogram: Dict[str, int] = field(default_factory=dict)

    # Interpretant histogram (Rheme, Dicent, Argument)
    interpretant_histogram: Dict[str, int] = field(default_factory=dict)

    # Average weights across all accepted events
    avg_firstness: float = 0.0
    avg_secondness: float = 0.0
    avg_thirdness: float = 0.0

    # PPS proxy (1 - avg_firstness)
    avg_pps: float = 0.0

    def normalized_class_distribution(self) -> Dict[int, float]:
        """Return class_id → probability (sum to 1.0)."""
        if self.accepted_events == 0:
            return {}
        return {
            cid: count / self.accepted_events
            for cid, count in self.class_histogram.items()
        }

    def normalized_band_distribution(self) -> Dict[str, float]:
        """Return band → probability."""
        if self.accepted_events == 0:
            return {}
        return {
            band: count / self.accepted_events
            for band, count in self.band_histogram.items()
        }


@dataclass
class SemioticDriftObservation:
    """Drift between two consecutive snapshots."""
    cycle_id: str
    previous_cycle_id: str
    timestamp: float

    # KL divergence from previous to current (D_KL(prev || current))
    kl_divergence: float = 0.0

    # Chi-squared statistic (symmetric)
    chi_squared: float = 0.0

    # Maximum absolute delta in any single class probability
    max_class_delta: float = 0.0
    max_class_delta_id: Optional[int] = None

    # Band-level deltas
    band_deltas: Dict[str, float] = field(default_factory=dict)

    # Detected drift patterns
    drift_patterns: List[str] = field(default_factory=list)

    # Overall drift score (0.0–1.0+), aligned with Antikythera scale
    drift_score: float = 0.0

    # Drift category: WITHIN_VARIANCE | SYSTEMATIC_DRIFT | ANOMALOUS_DEVIATION
    category: str = "WITHIN_VARIANCE"


@dataclass
class DriftPattern:
    """Named drift pattern with detection logic."""
    name: str
    description: str
    # Function: (current, previous) → bool
    detector: callable


# ── Pattern detectors ───────────────────────────────────────────────────────────

def _detect_icon_surge(current: SemioticDistributionSnapshot, previous: SemioticDistributionSnapshot) -> bool:
    """Detect significant increase in ICON mode (raw icons, resemblance)."""
    if previous.accepted_events == 0 or current.accepted_events == 0:
        return False
    prev_icon_ratio = previous.mode_histogram.get("ICON", 0) / previous.accepted_events
    curr_icon_ratio = current.mode_histogram.get("ICON", 0) / current.accepted_events
    return curr_icon_ratio > prev_icon_ratio + 0.15 and curr_icon_ratio > 0.3


def _detect_formal_thought_decline(current: SemioticDistributionSnapshot, previous: SemioticDistributionSnapshot) -> bool:
    """Detect decline in FORMAL_THOUGHT band (reasoned inference)."""
    if previous.accepted_events == 0 or current.accepted_events == 0:
        return False
    prev_formal = previous.band_histogram.get("FORMAL_THOUGHT", 0) / previous.accepted_events
    curr_formal = current.band_histogram.get("FORMAL_THOUGHT", 0) / current.accepted_events
    return prev_formal - curr_formal > 0.15 and curr_formal < 0.4


def _detect_index_atrophy(current: SemioticDistributionSnapshot, previous: SemioticDistributionSnapshot) -> bool:
    """Detect decline in INDEX mode (causal, trace-based relations)."""
    if previous.accepted_events == 0 or current.accepted_events == 0:
        return False
    prev_index = previous.mode_histogram.get("INDEX", 0) / previous.accepted_events
    curr_index = current.mode_histogram.get("INDEX", 0) / current.accepted_events
    return prev_index - curr_index > 0.15 and curr_index < 0.2


def _detect_firstness_surge(current: SemioticDistributionSnapshot, previous: SemioticDistributionSnapshot) -> bool:
    """Detect surge in firstness (pure quality, feeling, sensation)."""
    if previous.accepted_events == 0 or current.accepted_events == 0:
        return False
    return current.avg_firstness > previous.avg_firstness + 0.15 and current.avg_firstness > 0.45


def _detect_thirdness_collapse(current: SemioticDistributionSnapshot, previous: SemioticDistributionSnapshot) -> bool:
    """Detect collapse in thirdness (reason, law, convention)."""
    if previous.accepted_events == 0 or current.accepted_events == 0:
        return False
    return previous.avg_thirdness - current.avg_thirdness > 0.15 and current.avg_thirdness < 0.25


DRIFT_PATTERNS: List[DriftPattern] = [
    DriftPattern("ICON_SURGE", "Corpus sliding toward raw resemblance/icons", _detect_icon_surge),
    DriftPattern("FORMAL_THOUGHT_DECLINE", "Decline in reasoned/formal thought", _detect_formal_thought_decline),
    DriftPattern("INDEX_ATROPHY", "Loss of causal/trace-based relations", _detect_index_atrophy),
    DriftPattern("FIRSTNESS_SURGE", "Surge in pure quality/feeling (raw phenomenology)", _detect_firstness_surge),
    DriftPattern("THIRDNESS_COLLAPSE", "Collapse in law/reason/convention", _detect_thirdness_collapse),
]


# ── Core computation ────────────────────────────────────────────────────────────

class SemioticDriftLogger:
    """Logs semiotic class distributions per cycle and detects drift."""

    def __init__(self, log_dir: Optional[Path] = None):
        self.log_dir = log_dir or Path("logs/semiotic_drift")
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self._snapshots: List[SemioticDistributionSnapshot] = []
        self._manifold = get_manifold()

    def compute_snapshot(self, cycle_id: str, events: List[LogocEvent]) -> SemioticDistributionSnapshot:
        """Compute a distribution snapshot from a batch of events."""
        accepted = [e for e in events if not e.peirce_migration_pending]
        pending = [e for e in events if e.peirce_migration_pending]

        snapshot = SemioticDistributionSnapshot(
            cycle_id=cycle_id,
            timestamp=time.time(),
            total_events=len(events),
            accepted_events=len(accepted),
            pending_events=len(pending),
        )

        if not accepted:
            return snapshot

        firstness_sum = 0.0
        secondness_sum = 0.0
        thirdness_sum = 0.0

        for ev in accepted:
            peirce = ev.peirce
            if not peirce:
                continue

            # Class histogram
            cid = peirce.sign_class_id
            snapshot.class_histogram[cid] = snapshot.class_histogram.get(cid, 0) + 1

            # Band histogram
            band = peirce.pragmatism_band
            snapshot.band_histogram[band] = snapshot.band_histogram.get(band, 0) + 1

            # Mode histogram
            mode = peirce.mode
            snapshot.mode_histogram[mode] = snapshot.mode_histogram.get(mode, 0) + 1

            # Triad histograms
            path = peirce.path
            if len(path) >= 3:
                snapshot.vehicle_histogram[path[0]] = snapshot.vehicle_histogram.get(path[0], 0) + 1
                snapshot.object_histogram[path[1]] = snapshot.object_histogram.get(path[1], 0) + 1
                snapshot.interpretant_histogram[path[2]] = snapshot.interpretant_histogram.get(path[2], 0) + 1

            # Weights
            firstness_sum += peirce.firstness_weight
            secondness_sum += peirce.secondness_weight
            thirdness_sum += peirce.thirdness_weight

        n = len(accepted)
        snapshot.avg_firstness = firstness_sum / n
        snapshot.avg_secondness = secondness_sum / n
        snapshot.avg_thirdness = thirdness_sum / n
        snapshot.avg_pps = 1.0 - snapshot.avg_firstness

        return snapshot

    def compute_drift(
        self,
        current: SemioticDistributionSnapshot,
        previous: SemioticDistributionSnapshot,
    ) -> SemioticDriftObservation:
        """Compute drift between two snapshots."""
        obs = SemioticDriftObservation(
            cycle_id=current.cycle_id,
            previous_cycle_id=previous.cycle_id,
            timestamp=time.time(),
        )

        if current.accepted_events < MIN_SAMPLE_SIZE or previous.accepted_events < MIN_SAMPLE_SIZE:
            obs.category = "WITHIN_VARIANCE"
            obs.drift_score = 0.0
            return obs

        prev_dist = previous.normalized_class_distribution()
        curr_dist = current.normalized_class_distribution()

        # KL divergence: D_KL(prev || curr) = sum(prev[i] * log(prev[i]/curr[i]))
        kl = 0.0
        for cid, p in prev_dist.items():
            q = curr_dist.get(cid, 1e-10)  # Smoothing for zero probabilities
            if p > 0:
                kl += p * math.log(p / q)
        obs.kl_divergence = kl

        # Chi-squared: sum((curr - prev)^2 / prev)
        chi2 = 0.0
        for cid in set(prev_dist.keys()) | set(curr_dist.keys()):
            p = prev_dist.get(cid, 0.0)
            q = curr_dist.get(cid, 0.0)
            if p > 0:
                chi2 += (q - p) ** 2 / p
        obs.chi_squared = chi2

        # Max class delta
        max_delta = 0.0
        max_delta_id = None
        for cid in set(prev_dist.keys()) | set(curr_dist.keys()):
            p = prev_dist.get(cid, 0.0)
            q = curr_dist.get(cid, 0.0)
            delta = abs(q - p)
            if delta > max_delta:
                max_delta = delta
                max_delta_id = cid
        obs.max_class_delta = max_delta
        obs.max_class_delta_id = max_delta_id

        # Band deltas
        prev_bands = previous.normalized_band_distribution()
        curr_bands = current.normalized_band_distribution()
        for band in set(prev_bands.keys()) | set(curr_bands.keys()):
            p = prev_bands.get(band, 0.0)
            q = curr_bands.get(band, 0.0)
            obs.band_deltas[band] = q - p

        # Detect patterns
        for pattern in DRIFT_PATTERNS:
            if pattern.detector(current, previous):
                obs.drift_patterns.append(pattern.name)

        # Compute composite drift score (0.0–1.0+)
        # Components: KL divergence (scaled), chi-squared (scaled), max delta, pattern count
        score = 0.0
        score += min(kl * 2.0, 0.3)  # KL contributes up to 0.3
        score += min(chi2 * 0.5, 0.3)  # Chi-squared contributes up to 0.3
        score += max_delta * 0.3  # Max delta contributes up to 0.3
        score += len(obs.drift_patterns) * 0.1  # Each pattern adds 0.1
        obs.drift_score = min(score, 1.0)

        # Category based on score (aligned with Antikythera thresholds)
        if obs.drift_score >= SEMIOTIC_ANOMALY_THRESHOLD:
            obs.category = "ANOMALOUS_DEVIATION"
        elif obs.drift_score >= SEMIOTIC_DRIFT_THRESHOLD:
            obs.category = "SYSTEMATIC_DRIFT"
        else:
            obs.category = "WITHIN_VARIANCE"

        return obs

    def log_cycle(self, cycle_id: str, events: List[LogocEvent]) -> Optional[SemioticDriftObservation]:
        """Log a cycle and compute drift from previous cycle."""
        snapshot = self.compute_snapshot(cycle_id, events)
        self._snapshots.append(snapshot)

        # Write snapshot
        snap_path = self.log_dir / f"snapshot_{cycle_id}.json"
        with snap_path.open("w", encoding="utf-8") as f:
            json.dump(asdict(snapshot), f, indent=2, default=str)

        # Compute drift if we have a previous snapshot
        drift = None
        if len(self._snapshots) >= 2:
            previous = self._snapshots[-2]
            drift = self.compute_drift(snapshot, previous)

            # Write drift observation
            drift_path = self.log_dir / f"drift_{previous.cycle_id}_to_{cycle_id}.json"
            with drift_path.open("w", encoding="utf-8") as f:
                json.dump(asdict(drift), f, indent=2, default=str)

        return drift

    def get_latest_snapshot(self) -> Optional[SemioticDistributionSnapshot]:
        return self._snapshots[-1] if self._snapshots else None

    def get_drift_history(self) -> List[SemioticDriftObservation]:
        """Return all drift observations from logged files."""
        observations = []
        for drift_file in sorted(self.log_dir.glob("drift_*.json")):
            with drift_file.open("r", encoding="utf-8") as f:
                data = json.load(f)
                observations.append(SemioticDriftObservation(**data))
        return observations


# ── Convenience functions ───────────────────────────────────────────────────────

def compute_corpus_drift(
    previous_events: List[LogocEvent],
    current_events: List[LogocEvent],
    cycle_id: str = "current",
    previous_cycle_id: str = "previous",
) -> SemioticDriftObservation:
    """One-shot drift computation between two event batches."""
    logger = SemioticDriftLogger()
    prev_snap = logger.compute_snapshot(previous_cycle_id, previous_events)
    curr_snap = logger.compute_snapshot(cycle_id, current_events)
    return logger.compute_drift(curr_snap, prev_snap)
