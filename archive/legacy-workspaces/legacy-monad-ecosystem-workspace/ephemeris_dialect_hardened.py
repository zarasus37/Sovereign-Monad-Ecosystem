"""
EphemerisDialect HARDENED — Layer 4 Epicyclic Correction Engine
Full implementation with:
  1. Drift classification boundaries anchored to 0.72 authenticity floor
  2. Write-ahead logging + slot-indexed content-addressed storage
  3. Three-tier anomalous deviation containment (output quarantine → slot suspension → pipeline halt)

The system's self-consistency is enforced: the same 0.72 root that defines
agent alignment also defines drift tolerability.
"""

import json
import hashlib
import time
from enum import Enum
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple, Set
from pathlib import Path
from collections import deque


class DriftCategory(Enum):
    """Classification of observed execution drift."""
    WITHIN_VARIANCE = "WITHIN_VARIANCE"          # 0.00–0.27: noise
    SYSTEMATIC_DRIFT = "SYSTEMATIC_DRIFT"        # 0.28–0.71: recalibrate
    ANOMALOUS_DEVIATION = "ANOMALOUS_DEVIATION"  # 0.72+: isolate & contain


class AnomalyTier(Enum):
    """Containment response tier for anomalies."""
    TIER_1_OUTPUT_QUARANTINE = "TIER_1_OUTPUT_QUARANTINE"          # First occurrence
    TIER_2_SLOT_SUSPENSION = "TIER_2_SLOT_SUSPENSION"              # Repeated at one slot
    TIER_3_PIPELINE_HALT = "TIER_3_PIPELINE_HALT"                  # Cross-slot systemic


class ExecutionPhase(Enum):
    """Phase of anomaly response."""
    EXECUTING = "EXECUTING"
    QUARANTINED = "QUARANTINED"
    SUSPENDED = "SUSPENDED"
    HALTED = "HALTED"


@dataclass
class WALEntry:
    """Write-ahead log entry for durability."""
    slot: int
    delta: float
    cycle_id: str
    timestamp: int  # nanoseconds
    category: str   # DriftCategory.value
    wal_signature: str = ""


@dataclass
class DriftObservation:
    """A single drift measurement."""
    slot: int
    predicted_friction: float
    observed_friction: float
    delta: float
    category: DriftCategory
    cycle_id: str
    timestamp: float


@dataclass
class AnomalyRecord:
    """Record of an anomalous deviation event."""
    slot: int
    cycle_id: str
    timestamp: float
    tier: AnomalyTier
    affected_slots: List[int] = field(default_factory=list)
    action_taken: str = ""
    containment_status: str = "ACTIVE"


class WALManager:
    """Write-ahead logging for phase register persistence."""

    def __init__(self, wal_path: Optional[str] = None):
        self.wal_path = Path(wal_path) if wal_path else None
        self.wal_entries: deque = deque(maxlen=10000)
        self._load_wal()

    def _load_wal(self):
        """Load WAL entries from disk on startup."""
        if not self.wal_path or not self.wal_path.exists():
            return
        try:
            with open(self.wal_path, 'r') as f:
                for line in f:
                    if line.strip():
                        entry_dict = json.loads(line)
                        entry = WALEntry(
                            slot=entry_dict["slot"],
                            delta=entry_dict["delta"],
                            cycle_id=entry_dict["cycle_id"],
                            timestamp=entry_dict["timestamp"],
                            category=entry_dict["category"],
                            wal_signature=entry_dict["wal_signature"]
                        )
                        self.wal_entries.append(entry)
        except Exception as e:
            print(f"Warning: Failed to load WAL: {e}")

    def append_entry(self, slot: int, delta: float, cycle_id: str, category: str) -> WALEntry:
        """Append entry to WAL (write to disk first, then in-memory)."""
        timestamp = time.time_ns()
        entry = WALEntry(
            slot=slot,
            delta=delta,
            cycle_id=cycle_id,
            timestamp=timestamp,
            category=category
        )

        # Compute WAL signature
        sig_str = f"{slot}|{delta}|{cycle_id}|{timestamp}"
        entry.wal_signature = hashlib.sha256(sig_str.encode()).hexdigest()[:16]

        # Write to disk immediately (before in-memory update)
        if self.wal_path:
            self.wal_path.parent.mkdir(parents=True, exist_ok=True)
            try:
                with open(self.wal_path, 'a') as f:
                    f.write(json.dumps(asdict(entry)) + "\n")
            except Exception as e:
                print(f"Warning: Failed to write WAL entry: {e}")

        # Then add to in-memory queue
        self.wal_entries.append(entry)
        return entry

    def get_entries_for_slot(self, slot: int) -> List[WALEntry]:
        """Retrieve all WAL entries for a specific slot."""
        return [e for e in self.wal_entries if e.slot == slot]


class SlotCorrectionProfile:
    """
    Per-slot correction history, stored as content-addressed file.
    Indexed by slot number and Llullian attributes.
    """

    def __init__(self, slot: int, b_attr: str, k_principle: str, persist_path: Optional[str] = None):
        self.slot = slot
        self.b_attr = b_attr
        self.k_principle = k_principle
        self.persist_path = persist_path
        
        self.observations: List[DriftObservation] = []
        self.current_weight = 1.0
        self.last_recalibration_cycle = 0
        
        self._load_from_disk()

    def _compute_file_path(self) -> Path:
        """Content-addressed file: phase_register/{slot:03d}_{b_attr}_{k_principle}.json"""
        if not self.persist_path:
            return None
        base = Path(self.persist_path)
        filename = f"{self.slot:03d}_{self.b_attr}_{self.k_principle}.json"
        return base / filename

    def _load_from_disk(self):
        """Load correction profile from persistent storage."""
        path = self._compute_file_path()
        if not path or not path.exists():
            return
        try:
            with open(path, 'r') as f:
                data = json.load(f)
                self.observations = [
                    DriftObservation(
                        slot=obs["slot"],
                        predicted_friction=obs["predicted_friction"],
                        observed_friction=obs["observed_friction"],
                        delta=obs["delta"],
                        category=DriftCategory[obs["category"]],
                        cycle_id=obs["cycle_id"],
                        timestamp=obs["timestamp"]
                    )
                    for obs in data.get("observations", [])
                ]
                self.current_weight = data.get("current_weight", 1.0)
                self.last_recalibration_cycle = data.get("last_recalibration_cycle", 0)
        except Exception as e:
            print(f"Warning: Failed to load slot profile {self.slot}: {e}")

    def _save_to_disk(self):
        """Persist correction profile to storage."""
        path = self._compute_file_path()
        if not path:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(path, 'w') as f:
                json.dump({
                    "slot": self.slot,
                    "b_attr": self.b_attr,
                    "k_principle": self.k_principle,
                    "observations": [
                        {
                            "slot": obs.slot,
                            "predicted_friction": obs.predicted_friction,
                            "observed_friction": obs.observed_friction,
                            "delta": obs.delta,
                            "category": obs.category.value,
                            "cycle_id": obs.cycle_id,
                            "timestamp": obs.timestamp
                        }
                        for obs in self.observations
                    ],
                    "current_weight": self.current_weight,
                    "last_recalibration_cycle": self.last_recalibration_cycle
                }, f, indent=2)
        except Exception as e:
            print(f"Warning: Failed to save slot profile {self.slot}: {e}")

    def add_observation(self, obs: DriftObservation):
        """Record a drift observation for this slot."""
        self.observations.append(obs)
        self._save_to_disk()

    def get_recent_observations(self, window_size: int = 9) -> List[DriftObservation]:
        """Get the last N observations (rolling window)."""
        return self.observations[-window_size:]

    def count_systematic_in_window(self, window_size: int = 9) -> int:
        """Count SYSTEMATIC_DRIFT observations in rolling window."""
        recent = self.get_recent_observations(window_size)
        return sum(1 for obs in recent if obs.category == DriftCategory.SYSTEMATIC_DRIFT)

    def count_anomalies_in_window(self, window_size: int = 9) -> int:
        """Count ANOMALOUS_DEVIATION observations in rolling window."""
        recent = self.get_recent_observations(window_size)
        return sum(1 for obs in recent if obs.category == DriftCategory.ANOMALOUS_DEVIATION)


class DriftClassifier:
    """
    Hardened drift classification with 0.28/0.72 boundaries.
    Boundaries are anchored to the system's 0.72 authenticity floor.
    """

    # Classification thresholds — anchored to 0.72 authenticity root
    SYSTEMATIC_THRESHOLD = 0.28   # 1 - 0.72: variance above this is not noise
    ANOMALY_THRESHOLD = 0.72      # Full Name resonance threshold

    # Recalibration safety
    MIN_CYCLES_BEFORE_RECALIBRATION = 3    # Minimum observations
    ROLLING_WINDOW_SIZE = 9                 # Llullian B-set cardinality

    def __init__(self):
        self.observations_by_slot: Dict[int, List[DriftObservation]] = {}

    def classify_drift(
        self,
        slot: int,
        predicted_friction: float,
        observed_friction: float,
        cycle_id: str
    ) -> DriftObservation:
        """
        Classify observed friction delta into one of three categories.
        Delta boundaries are hardened and self-consistent with 0.72 root.
        """
        delta = abs(observed_friction - predicted_friction)

        # Classification logic
        if delta < self.SYSTEMATIC_THRESHOLD:
            category = DriftCategory.WITHIN_VARIANCE
        elif delta < self.ANOMALY_THRESHOLD:
            category = DriftCategory.SYSTEMATIC_DRIFT
        else:
            category = DriftCategory.ANOMALOUS_DEVIATION

        # Create observation record
        obs = DriftObservation(
            slot=slot,
            predicted_friction=predicted_friction,
            observed_friction=observed_friction,
            delta=delta,
            category=category,
            cycle_id=cycle_id,
            timestamp=time.time()
        )

        # Record in history
        if slot not in self.observations_by_slot:
            self.observations_by_slot[slot] = []
        self.observations_by_slot[slot].append(obs)

        return obs

    def should_recalibrate(self, slot: int) -> bool:
        """
        Determine if Peirce threshold should be recalibrated for this slot.
        Conservative: requires MIN_CYCLES consecutive SYSTEMATIC_DRIFT in rolling window.
        """
        recent = self.observations_by_slot.get(slot, [])[-self.ROLLING_WINDOW_SIZE:]
        
        if len(recent) < self.MIN_CYCLES_BEFORE_RECALIBRATION:
            return False

        # Count SYSTEMATIC_DRIFT in window
        systematic_count = sum(
            1 for obs in recent
            if obs.category == DriftCategory.SYSTEMATIC_DRIFT
        )

        return systematic_count >= self.MIN_CYCLES_BEFORE_RECALIBRATION


class AnomalyContainmentEngine:
    """
    Three-tier anomaly response system.
    Escalates proportionally without over-correcting on single observations.
    """

    def __init__(self):
        self.quarantined_outputs: Dict[str, dict] = {}      # output_id -> metadata
        self.suspended_slots: Set[int] = set()               # slots under Tier 2
        self.pipeline_halt_active = False
        self.anomaly_records: List[AnomalyRecord] = []

    def tier_1_quarantine_output(
        self,
        output_id: str,
        slot: int,
        cycle_id: str,
        output_data: dict
    ) -> AnomalyRecord:
        """
        Tier 1: First anomaly at a slot.
        Action: Quarantine the output, not the slot.
        The slot itself continues operating; only this one result is held.
        """
        self.quarantined_outputs[output_id] = {
            "slot": slot,
            "cycle_id": cycle_id,
            "timestamp": time.time(),
            "data": output_data,
            "status": "QUARANTINED"
        }

        record = AnomalyRecord(
            slot=slot,
            cycle_id=cycle_id,
            timestamp=time.time(),
            tier=AnomalyTier.TIER_1_OUTPUT_QUARANTINE,
            action_taken=f"Output {output_id} quarantined; slot {slot} continues operating"
        )
        self.anomaly_records.append(record)
        return record

    def tier_2_suspend_slot(
        self,
        slot: int,
        cycle_id: str,
        anomaly_count_in_window: int
    ) -> AnomalyRecord:
        """
        Tier 2: Repeated anomaly at same slot (2+ in rolling window).
        Action: Suspend slot from new assignments. Reroute via Tabula Generalis.
        """
        self.suspended_slots.add(slot)

        record = AnomalyRecord(
            slot=slot,
            cycle_id=cycle_id,
            timestamp=time.time(),
            tier=AnomalyTier.TIER_2_SLOT_SUSPENSION,
            affected_slots=[slot],
            action_taken=(
                f"Slot {slot} suspended after {anomaly_count_in_window} anomalies in window. "
                f"Incoming expressions rerouted via Tabula Generalis."
            )
        )
        self.anomaly_records.append(record)
        return record

    def tier_3_pipeline_halt(
        self,
        affected_slots: List[int],
        cycle_id: str
    ) -> AnomalyRecord:
        """
        Tier 3: Cross-slot systemic anomaly (3+ distinct slots in same cycle).
        Action: Halt pipeline, trigger EphemerisDialect full audit.
        """
        self.pipeline_halt_active = True

        record = AnomalyRecord(
            slot=-1,  # System-level, not slot-specific
            cycle_id=cycle_id,
            timestamp=time.time(),
            tier=AnomalyTier.TIER_3_PIPELINE_HALT,
            affected_slots=affected_slots,
            action_taken=(
                f"Pipeline halted. Systemic anomaly detected across {len(affected_slots)} slots. "
                f"Full EphemerisDialect audit required before resumption."
            ),
            containment_status="HALTED"
        )
        self.anomaly_records.append(record)
        return record

    def is_slot_suspended(self, slot: int) -> bool:
        """Check if slot is under Tier 2 suspension."""
        return slot in self.suspended_slots

    def is_pipeline_halted(self) -> bool:
        """Check if pipeline is under Tier 3 halt."""
        return self.pipeline_halt_active

    def get_quarantined_output(self, output_id: str) -> Optional[dict]:
        """Retrieve a quarantined output for manual review."""
        return self.quarantined_outputs.get(output_id)

    def lift_tier_2_suspension(self, slot: int):
        """After audit, lift Tier 2 suspension."""
        self.suspended_slots.discard(slot)

    def resume_pipeline(self):
        """After audit, resume pipeline from Tier 3 halt."""
        self.pipeline_halt_active = False


class EphemerisDialect:
    """
    Complete hardened observation, classification, and correction system.
    
    INVARIANTS:
      1. Drift boundaries are 0.28 (SYSTEMATIC threshold) and 0.72 (ANOMALY threshold)
      2. All state persists via WAL + slot-indexed content-addressed storage
      3. Anomalies escalate through three tiers, never over-correcting on single observations
      4. Cold start initializes all 144 slots to delta=0.0, n=0 (clean slate)
    """

    def __init__(
        self,
        wal_path: Optional[str] = None,
        slot_profile_path: Optional[str] = None,
        alphabet_mapping: Optional[Dict[int, Tuple[str, str]]] = None
    ):
        """
        Initialize hardened ephemeris system.
        
        Args:
            wal_path: Path to write-ahead log
            slot_profile_path: Base path for slot correction profiles
            alphabet_mapping: Dict[slot] -> (b_attr, k_principle), e.g. {0: ("Goodness", "What")}
        """
        self.wal_manager = WALManager(wal_path)
        self.classifier = DriftClassifier()
        self.containment = AnomalyContainmentEngine()
        
        self.slot_profiles: Dict[int, SlotCorrectionProfile] = {}
        self.alphabet_mapping = alphabet_mapping or self._default_alphabet()
        
        # Initialize all 144 slot profiles
        self._cold_start_bootstrap(slot_profile_path)
        
        self.cycle_counter = 0

    def _default_alphabet(self) -> Dict[int, Tuple[str, str]]:
        """Default Llullian alphabet mapping for all 144 slots."""
        b_set = [
            "Goodness", "Greatness", "Eternity", "Power",
            "Wisdom", "Will", "Virtue", "Truth", "Glory"
        ]
        k_set = [
            "What", "Why", "How", "Whence", "Whither", "When", "Whether", "Degree",
            "Opposition", "Beginning", "Middle", "End", "Conjunction", "Division",
            "Union", "Harmony"
        ]
        return {
            i: (b_set[i // 16], k_set[i % 16])
            for i in range(144)
        }

    def _cold_start_bootstrap(self, slot_profile_path: Optional[str]):
        """
        Initialize all 144 slot profiles on startup.
        Load from disk if exists; otherwise initialize to clean state.
        """
        for slot in range(144):
            b_attr, k_principle = self.alphabet_mapping[slot]
            profile = SlotCorrectionProfile(
                slot=slot,
                b_attr=b_attr,
                k_principle=k_principle,
                persist_path=slot_profile_path
            )
            self.slot_profiles[slot] = profile

    def observe_and_classify(
        self,
        slot: int,
        predicted_friction: float,
        observed_friction: float,
        cycle_id: str,
        execution_output: Optional[dict] = None
    ) -> Tuple[DriftObservation, Optional[AnomalyRecord]]:
        """
        Main observation workflow: classify drift and take containment action if needed.

        Returns:
            (drift_observation, anomaly_record_or_none)
        """
        self.cycle_counter += 1

        # Step 1: Classify drift
        obs = self.classifier.classify_drift(
            slot=slot,
            predicted_friction=predicted_friction,
            observed_friction=observed_friction,
            cycle_id=cycle_id
        )

        # Step 2: Record to WAL
        self.wal_manager.append_entry(
            slot=slot,
            delta=obs.delta,
            cycle_id=cycle_id,
            category=obs.category.value
        )

        # Step 3: Add to slot profile
        profile = self.slot_profiles[slot]
        profile.add_observation(obs)

        # Step 4: Determine containment action (if any)
        anomaly_record = None

        if obs.category == DriftCategory.ANOMALOUS_DEVIATION:
            anomaly_count = profile.count_anomalies_in_window()
            
            # Tier 1: First anomaly
            if anomaly_count == 1:
                output_id = f"QUARANTINE-{slot}-{cycle_id[:8]}"
                anomaly_record = self.containment.tier_1_quarantine_output(
                    output_id=output_id,
                    slot=slot,
                    cycle_id=cycle_id,
                    output_data=execution_output or {}
                )
            
            # Tier 2: Repeated anomalies
            elif anomaly_count >= 2:
                if not self.containment.is_slot_suspended(slot):
                    anomaly_record = self.containment.tier_2_suspend_slot(
                        slot=slot,
                        cycle_id=cycle_id,
                        anomaly_count_in_window=anomaly_count
                    )

        # Step 5: Check for cross-slot systemic signal (Tier 3)
        if not self.containment.is_pipeline_halted():
            anomalous_slots_this_cycle = [
                s for s in range(144)
                if (self.slot_profiles[s].observations 
                    and self.slot_profiles[s].observations[-1].cycle_id == cycle_id
                    and self.slot_profiles[s].observations[-1].category == DriftCategory.ANOMALOUS_DEVIATION)
            ]
            if len(anomalous_slots_this_cycle) >= 3:
                anomaly_record = self.containment.tier_3_pipeline_halt(
                    affected_slots=anomalous_slots_this_cycle,
                    cycle_id=cycle_id
                )

        return obs, anomaly_record

    def should_recalibrate_peirce(self, slot: int) -> bool:
        """
        Check if Peirce's friction threshold should be recalibrated.
        Conservative: requires 3+ SYSTEMATIC_DRIFT in rolling window.
        """
        return self.classifier.should_recalibrate(slot)

    def get_correction_coefficient(self, slot: int) -> float:
        """
        Get the phase correction weight for this slot.
        Applied as: corrected_friction = base_friction * coefficient
        """
        profile = self.slot_profiles[slot]
        return profile.current_weight

    def get_slot_status(self, slot: int) -> Dict:
        """Comprehensive status report for a slot."""
        profile = self.slot_profiles[slot]
        recent = profile.get_recent_observations(9)
        return {
            "slot": slot,
            "b_attr": profile.b_attr,
            "k_principle": profile.k_principle,
            "observations_count": len(profile.observations),
            "current_weight": profile.current_weight,
            "last_recalibration_cycle": profile.last_recalibration_cycle,
            "recent_observations": [
                {
                    "delta": obs.delta,
                    "category": obs.category.value,
                    "cycle_id": obs.cycle_id,
                    "timestamp": obs.timestamp
                }
                for obs in recent
            ],
            "suspended": self.containment.is_slot_suspended(slot),
            "anomaly_count_in_window": profile.count_anomalies_in_window(9)
        }

    def emit_full_audit_report(self) -> Dict:
        """Generate comprehensive audit report across all 144 slots."""
        return {
            "timestamp": time.time(),
            "cycle_counter": self.cycle_counter,
            "pipeline_halted": self.containment.is_pipeline_halted(),
            "quarantined_outputs_count": len(self.containment.quarantined_outputs),
            "suspended_slots_count": len(self.containment.suspended_slots),
            "anomaly_records": [
                {
                    "slot": r.slot,
                    "cycle_id": r.cycle_id,
                    "tier": r.tier.value,
                    "affected_slots": r.affected_slots,
                    "action": r.action_taken
                }
                for r in self.containment.anomaly_records
            ],
            "slot_summaries": {
                str(slot): self.get_slot_status(slot)
                for slot in range(144)
            }
        }
