#!/usr/bin/env python3
"""
LTP-ML Apoptosis Engine v1.0
Programmed data release — autonomous developmental utility tracking.

The system determines what to keep, what to deprecate, and when to release.
No manual intervention. Retention requires active renewal.
Non-renewal IS apoptosis by default.

Integrates with:
  - ltpml_runtime.py  (GnosisEvent generation)
  - Scheduler         (apoptotic load as learning velocity signal)
  - Training pipeline (dynamic training pool management)
"""

from __future__ import annotations
import json, uuid, math
from dataclasses import dataclass, field, asdict
from typing import Optional
from enum import Enum
from pathlib import Path

# ─── TYPES ────────────────────────────────────────────────────────────────────

class ApoptoticStatus(str, Enum):
    Active    = "Active"     # Providing gradient signal — retain
    Scheduled = "Scheduled"  # Utility below trigger — release next epoch
    Released  = "Released"   # Memory freed — provenance stub only

class RetentionSignal(str, Enum):
    High     = "High"      # Still on learning frontier
    Fading   = "Fading"    # Signal declining but nonzero
    Residual = "Residual"  # Near zero — apoptosis imminent
    Silent   = "Silent"    # Zero — released

# ─── DEVELOPMENTAL UTILITY TRACKER ───────────────────────────────────────────

@dataclass
class UtilityTracker:
    """
    Per-event developmental utility state.
    Updated each epoch by the ApoptosisEngine.
    retention_score is dynamic — not a fixed threshold.
    """
    event_id:          str
    initial_signal:    float = 1.0    # Gradient contribution at generation
    current_signal:    float = 1.0    # Updated each epoch
    epochs_active:     int   = 0      # How many epochs this has been in pool
    superseded_by:     list  = field(default_factory=list)  # Higher-conf descendants
    retention_score:   float = 1.0    # Dynamic composite score
    apoptosis_trigger: float = 0.15   # Release when retention_score < this
    status:            ApoptoticStatus = ApoptoticStatus.Active
    signal_class:      RetentionSignal = RetentionSignal.High
    scheduled_release_epoch: Optional[int] = None
    provenance_stub:   Optional[str] = None  # Persists after release

    def update(self, gradient_contribution: float, epoch: int,
               superseding_events: list[str]) -> None:
        """
        Called each epoch by ApoptosisEngine.
        Gradient contribution is normalized [0,1] relative to pool average.
        """
        self.epochs_active = epoch
        self.current_signal = gradient_contribution

        # Accumulate supersession pressure
        for eid in superseding_events:
            if eid not in self.superseded_by:
                self.superseded_by.append(eid)

        # Supersession decay: each superseding event reduces retention
        supersession_factor = max(0.0, 1.0 - (len(self.superseded_by) * 0.12))

        # Age factor: newer events at frontier carry more weight
        # Long-lived events get slight decay (model already internalized them)
        age_decay = max(0.3, 1.0 - (self.epochs_active * 0.02))

        # Recency of signal contribution
        signal_weight = gradient_contribution

        # Composite retention score
        self.retention_score = round(
            0.50 * signal_weight +
            0.30 * supersession_factor +
            0.20 * age_decay,
            4
        )

        # Classify signal
        if self.retention_score >= 0.60:
            self.signal_class = RetentionSignal.High
        elif self.retention_score >= 0.35:
            self.signal_class = RetentionSignal.Fading
        elif self.retention_score >= self.apoptosis_trigger:
            self.signal_class = RetentionSignal.Residual
        else:
            self.signal_class = RetentionSignal.Silent

        # Trigger apoptosis
        if self.retention_score < self.apoptosis_trigger                 and self.status == ApoptoticStatus.Active:
            self.status = ApoptoticStatus.Scheduled
            self.scheduled_release_epoch = epoch + 1

    def renew(self) -> None:
        """
        Explicit re-retention — resets decay pressure.
        If not called and signal drops: apoptosis fires by default.
        """
        if self.status == ApoptoticStatus.Scheduled:
            self.status = ApoptoticStatus.Active
            self.scheduled_release_epoch = None
            self.signal_class = RetentionSignal.High

    def release(self) -> str:
        """
        Linear type: must be called exactly once.
        Frees full event data; returns provenance stub.
        """
        if self.status == ApoptoticStatus.Released:
            raise RuntimeError(
                f"Double-release violation on event {self.event_id} "
                f"(linear type: RetentionHandle must be released exactly once)"
            )
        self.status = ApoptoticStatus.Released
        self.current_signal = 0.0
        self.signal_class = RetentionSignal.Silent
        stub = f"STUB::{self.event_id}::epochs={self.epochs_active}::superseded={len(self.superseded_by)}"
        self.provenance_stub = stub
        return stub


# ─── RETENTION HANDLE (Linear Type) ──────────────────────────────────────────

@dataclass
class RetentionHandle:
    """
    Linear type wrapper for GnosisEvent retention.
    - retain()  → issues handle
    - release() → consumes handle (exactly once)
    - renew()   → re-activates if Scheduled (prevents apoptosis this epoch)
    Compiler analogue: holding without renewal = type violation = auto-release.
    """
    handle_id:   str
    event_id:    str
    tracker:     UtilityTracker
    _consumed:   bool = False

    def renew(self) -> "RetentionHandle":
        if self._consumed:
            raise RuntimeError(f"Handle {self.handle_id} already consumed.")
        self.tracker.renew()
        return self

    def release(self) -> str:
        if self._consumed:
            raise RuntimeError(
                f"LinearType violation: RetentionHandle {self.handle_id} "
                "consumed twice."
            )
        self._consumed = True
        return self.tracker.release()

    @property
    def status(self) -> ApoptoticStatus:
        return self.tracker.status

    @property
    def retention_score(self) -> float:
        return self.tracker.retention_score


# ─── APOPTOSIS ENGINE ─────────────────────────────────────────────────────────

class ApoptosisEngine:
    """
    Autonomous developmental utility tracker for the training pool.

    Each epoch:
      1. Computes gradient contribution per event (normalized)
      2. Updates UtilityTracker for each event
      3. Schedules apoptosis for events below trigger
      4. Executes releases for Scheduled events from prior epoch
      5. Emits apoptotic load metric to scheduler feedback loop

    The scheduler reads apoptotic_rate as learning velocity:
      High release rate in region X → model has metabolized region X
      Low release rate → still on learning frontier → keep sampling there
    """

    def __init__(self, trigger_threshold: float = 0.15):
        self.trigger_threshold = trigger_threshold
        self.pool: dict[str, dict]          = {}   # event_id → full event
        self.handles: dict[str, RetentionHandle] = {}
        self.trackers: dict[str, UtilityTracker] = {}
        self.released_stubs: dict[str, str]      = {}  # event_id → stub
        self.epoch: int = 0
        self.epoch_log: list[dict]               = []

    def retain(self, event: dict) -> RetentionHandle:
        """Register a GnosisEvent with the engine. Returns a RetentionHandle."""
        eid = event["event_id"]
        self.pool[eid] = event
        tracker = UtilityTracker(
            event_id=eid,
            initial_signal=event.get("constitution_score", {}).get("total", 0.8),
            current_signal=event.get("constitution_score", {}).get("total", 0.8),
            apoptosis_trigger=self.trigger_threshold
        )
        self.trackers[eid] = tracker
        handle = RetentionHandle(
            handle_id=str(uuid.uuid4())[:8],
            event_id=eid,
            tracker=tracker
        )
        self.handles[eid] = handle
        return handle

    def step_epoch(self, gradient_contributions: dict[str, float]) -> dict:
        """
        Advance one training epoch.
        gradient_contributions: {event_id: normalized_gradient_contribution [0,1]}

        Returns epoch metrics including apoptotic_load for scheduler feedback.
        """
        self.epoch += 1
        scheduled_this_epoch = []
        released_this_epoch  = []

        # 1. Execute releases for events Scheduled in prior epoch
        for eid, tracker in list(self.trackers.items()):
            if (tracker.status == ApoptoticStatus.Scheduled and
                    tracker.scheduled_release_epoch is not None and
                    tracker.scheduled_release_epoch <= self.epoch):
                handle = self.handles.get(eid)
                if handle and not handle._consumed:
                    stub = handle.release()
                    self.released_stubs[eid] = stub
                    del self.pool[eid]           # Free full event data
                    released_this_epoch.append(eid)

        # 2. Update trackers for active events
        active_eids = [eid for eid, t in self.trackers.items()
                       if t.status == ApoptoticStatus.Active]

        for eid in active_eids:
            grad = gradient_contributions.get(eid, 0.05)
            # Find superseding events: same wheel region, higher constitution score
            superseding = self._find_superseding(eid)
            self.trackers[eid].update(grad, self.epoch, superseding)
            if self.trackers[eid].status == ApoptoticStatus.Scheduled:
                scheduled_this_epoch.append(eid)

        # 3. Compute apoptotic load for scheduler
        total_active    = len([t for t in self.trackers.values()
                               if t.status == ApoptoticStatus.Active])
        total_scheduled = len([t for t in self.trackers.values()
                               if t.status == ApoptoticStatus.Scheduled])
        total_released  = len(self.released_stubs)
        apoptotic_rate  = (len(released_this_epoch) /
                           max(1, total_active + len(released_this_epoch)))

        region_apoptotic_load = self._compute_region_apoptotic_load()

        metrics = {
            "epoch":               self.epoch,
            "pool_size":           len(self.pool),
            "active":              total_active,
            "scheduled":           total_scheduled,
            "released_total":      total_released,
            "released_this_epoch": len(released_this_epoch),
            "scheduled_this_epoch":len(scheduled_this_epoch),
            "apoptotic_rate":      round(apoptotic_rate, 4),
            "region_apoptotic_load": region_apoptotic_load,
            "released_ids":        released_this_epoch,
            "scheduled_ids":       scheduled_this_epoch,
        }
        self.epoch_log.append(metrics)
        return metrics

    def _find_superseding(self, eid: str) -> list[str]:
        """
        Find events in the pool that occupy same wheel-region
        with higher constitution score — these supersede eid.
        """
        if eid not in self.pool:
            return []
        target = self.pool[eid]
        target_score = target.get("constitution_score", {}).get("total", 0)
        target_slots = target.get("active_slots", {})
        superseding = []
        for other_eid, other_event in self.pool.items():
            if other_eid == eid:
                continue
            other_score = other_event.get("constitution_score", {}).get("total", 0)
            if other_score <= target_score:
                continue
            other_slots = other_event.get("active_slots", {})
            # Supersession: same theology slot, higher score
            if (target_slots.get("theology", {}).get("slot") ==
                    other_slots.get("theology", {}).get("slot")):
                superseding.append(other_eid)
        return superseding

    def _compute_region_apoptotic_load(self) -> dict[str, float]:
        """
        Per-wheel-region apoptotic load.
        High load → model has metabolized this region → scheduler explores elsewhere.
        """
        region_counts:   dict[str, int]   = {}
        region_released: dict[str, int]   = {}

        for eid, tracker in self.trackers.items():
            event = self.pool.get(eid, {})
            slot = (event.get("active_slots", {})
                        .get("theology", {})
                        .get("slot", "?"))
            region_counts[slot] = region_counts.get(slot, 0) + 1
            if tracker.status in (ApoptoticStatus.Scheduled,
                                   ApoptoticStatus.Released):
                region_released[slot] = region_released.get(slot, 0) + 1

        return {
            slot: round(region_released.get(slot, 0) /
                        max(1, region_counts[slot]), 3)
            for slot in region_counts
        }

    def apoptotic_load_penalty(self) -> float:
        """
        Scalar apoptotic load for scheduler objective:
        J = αC + βL + γT − δS − εA   where A = this value
        High value → avoid this region (already learned)
        Low value  → still fertile (keep sampling)
        """
        if not self.trackers:
            return 0.0
        scheduled_or_released = sum(
            1 for t in self.trackers.values()
            if t.status != ApoptoticStatus.Active
        )
        return round(scheduled_or_released / max(1, len(self.trackers)), 4)

    def pool_summary(self) -> dict:
        """Current state of the training pool."""
        signal_dist = {"High": 0, "Fading": 0, "Residual": 0, "Silent": 0}
        for t in self.trackers.values():
            signal_dist[t.signal_class.value] += 1
        return {
            "epoch":          self.epoch,
            "pool_size":      len(self.pool),
            "signal_dist":    signal_dist,
            "released_stubs": len(self.released_stubs),
            "apoptotic_load": self.apoptotic_load_penalty(),
        }

    def save_state(self, path: str) -> None:
        state = {
            "epoch":   self.epoch,
            "trackers": {
                eid: {
                    "retention_score": t.retention_score,
                    "status":          t.status.value,
                    "signal_class":    t.signal_class.value,
                    "epochs_active":   t.epochs_active,
                    "superseded_by":   t.superseded_by,
                    "provenance_stub": t.provenance_stub,
                }
                for eid, t in self.trackers.items()
            },
            "released_stubs": self.released_stubs,
            "epoch_log":      self.epoch_log,
        }
        with open(path, "w") as f:
            json.dump(state, f, indent=2)


# ─── DEMO SIMULATION ──────────────────────────────────────────────────────────

def simulate_apoptosis(n_events: int = 20, n_epochs: int = 12,
                       trigger: float = 0.15) -> dict:
    """
    Simulate apoptosis across n_events over n_epochs.
    Returns full epoch log and final pool summary.
    """
    import random
    random.seed(7)

    engine = ApoptosisEngine(trigger_threshold=trigger)

    # Generate synthetic pool of gnosis events
    slots = list("BCDEFGHIK")
    for i in range(n_events):
        score = round(random.uniform(0.70, 1.0), 3)
        slot  = slots[i % len(slots)]
        event = {
            "event_id": str(uuid.uuid4()),
            "active_slots": {
                "theology":   {"wheel": "A", "slot": slot,
                               "label": f"attr_{slot}"},
                "technology": {"wheel": "S", "slot": slot,
                               "label": f"act_{slot}"},
                "cosmology":  {"wheel": "X", "slot": slot,
                               "label": f"cat_{slot}"},
            },
            "constitution_score": {"total": score, "passes": score >= 0.72}
        }
        engine.retain(event)

    all_metrics = []
    for ep in range(n_epochs):
        # Simulate gradient contributions: earlier events fade, newer stay strong
        grad_contribs = {}
        for eid, tracker in engine.trackers.items():
            if tracker.status == ApoptoticStatus.Active:
                # Gradient fades as model learns the sample
                base = tracker.initial_signal
                fade = max(0.02, base * (0.88 ** tracker.epochs_active))
                noise = random.uniform(-0.05, 0.05)
                grad_contribs[eid] = max(0.0, min(1.0, fade + noise))

        metrics = engine.step_epoch(grad_contribs)
        all_metrics.append(metrics)

    final_summary = engine.pool_summary()
    engine.save_state("apoptosis_state.json")

    return {
        "final_summary": final_summary,
        "epoch_log":     all_metrics,
        "released_stubs": list(engine.released_stubs.values())[:3]
    }


if __name__ == "__main__":
    print("LTP-ML Apoptosis Engine v1.0")
    print("=" * 50)
    result = simulate_apoptosis(n_events=20, n_epochs=12)
    fs = result["final_summary"]
    print(f"Final epoch      : {fs['epoch']}")
    print(f"Active pool      : {fs['pool_size']} events")
    print(f"Signal dist      : {fs['signal_dist']}")
    print(f"Released stubs   : {fs['released_stubs']}")
    print(f"Apoptotic load   : {fs['apoptotic_load']}")
    print("\nEpoch-by-epoch release cadence:")
    for m in result["epoch_log"]:
        bar = "█" * m["released_this_epoch"]
        print(f"  Epoch {m['epoch']:>2} | pool={m['pool_size']:>3} | "
              f"released={m['released_this_epoch']} {bar} | "
              f"rate={m['apoptotic_rate']:.3f}")
    print("\nSample provenance stubs (post-release):")
    for stub in result["released_stubs"]:
        print(f"  {stub}")
    print("=" * 50)
    print("State saved → apoptosis_state.json")
