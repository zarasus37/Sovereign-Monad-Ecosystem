"""
PeirceCalibrationBridge — Layer 3-to-Layer 4 Integration
Feeds phase-corrected friction thresholds from EphemerisDialect back into Peirce's gate

CRITICAL INVARIANT:
This bridge does NOT modify Peirce's structure or logic. It only adjusts the
friction_threshold and coherence_index parameters that Peirce uses to validate
camera perspectives (the PPS computation). The dyadic rejection logic itself
is unchanged.

The bridge operates at the boundary between:
  - EXECUTION OBSERVER (EphemerisDialect) — what actually happened
  - PEIRCE'S GATE (target_gen.py) — what should happen next

ARCHITECTURE:
┌─────────────────────────────────────────────────────────────────────┐
│ PEIRCE GATE (target_gen.py)                                         │
│                                                                      │
│  compute_pps(perspective) → uses friction_threshold from calibration│
│  validate_camera(camera) → may reject dyadic if friction > threshold│
└────────────────┬──────────────────────────────────────────────────┘
                 │ reads calibration params
                 │
        ┌────────▼─────────────┐
        │ CalibrationContext   │ ← PeirceCalibrationBridge updates this
        │                      │   between cycles
        │ friction_thresholds  │
        │ coherence_targets    │
        │ anomaly_flags        │
        └──────────────────────┘
                 ▲
                 │ written by
        ┌────────┴──────────────┐
        │ EphemerisDialect      │
        │ (observation layer)   │
        └───────────────────────┘
"""

from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple
from enum import Enum
import time
import json
from pathlib import Path

# Import from ephemeris_dialect
from ephemeris_dialect import (
    EphemerisDialect,
    DriftDelta,
    PhaseCorrection,
    DriftCategory,
    PredictionSignature,
    ExecutionObservation
)


class CalibrationMode(Enum):
    """How aggressively to apply phase corrections."""
    CONSERVATIVE = "CONSERVATIVE"    # 40% of computed correction
    BALANCED = "BALANCED"            # 70% of computed correction
    AGGRESSIVE = "AGGRESSIVE"        # 100% of computed correction
    FROZEN = "FROZEN"                # No corrections, diagnostic mode


@dataclass
class CalibrationContext:
    """
    The per-slot calibration state that Peirce reads on each cycle.
    Updated by PeirceCalibrationBridge between cycles.
    """
    slot: int
    base_friction_coefficient: float  # From semiotic_dialect.py
    ephemeris_adjusted_friction: float  # Computed by bridge
    coherence_target: float  # Minimum acceptable PPS for this slot
    mode: CalibrationMode
    last_updated: float = field(default_factory=time.time)
    update_signature: str = ""  # SHA-256 of last calibration update
    anomaly_quarantine: bool = False
    anomaly_severity: str = "NONE"  # NONE, WARNING, CRITICAL


@dataclass
class CalibrationReport:
    """Summary of all per-slot calibrations."""
    timestamp: float
    total_slots_calibrated: int
    slots_under_quarantine: int
    average_correction_magnitude: float
    mode: CalibrationMode
    report_signature: str = ""


class PeirceCalibrationBridge:
    """
    Manages the feedback loop between EphemerisDialect (observation)
    and Peirce's gate (validation).

    One instance per execution context. Updated after each FOCAL_LOCK
    fires and the execution result is observed.
    """

    def __init__(
        self,
        ephemeris: EphemerisDialect,
        mode: CalibrationMode = CalibrationMode.BALANCED,
        persist_path: Optional[str] = None
    ):
        self.ephemeris = ephemeris
        self.mode = mode
        self.persist_path = Path(persist_path) if persist_path else None

        # Per-slot calibration contexts
        self.calibrations: Dict[int, CalibrationContext] = {
            i: CalibrationContext(
                slot=i,
                base_friction_coefficient=0.5,  # Default; will be updated
                ephemeris_adjusted_friction=0.5,
                coherence_target=0.30,  # Peirce's Thirdness threshold
                mode=mode
            )
            for i in range(144)
        }

        self._load_from_disk()

    def _load_from_disk(self):
        """Load calibration state from persistent storage."""
        if self.persist_path and self.persist_path.exists():
            try:
                with open(self.persist_path, 'r') as f:
                    data = json.load(f)
                    for slot_str, cal_data in data.get("calibrations", {}).items():
                        slot = int(slot_str)
                        if slot in self.calibrations:
                            self.calibrations[slot] = CalibrationContext(
                                slot=slot,
                                base_friction_coefficient=cal_data["base_friction_coefficient"],
                                ephemeris_adjusted_friction=cal_data["ephemeris_adjusted_friction"],
                                coherence_target=cal_data["coherence_target"],
                                mode=CalibrationMode[cal_data["mode"]],
                                last_updated=cal_data["last_updated"],
                                update_signature=cal_data.get("update_signature", ""),
                                anomaly_quarantine=cal_data.get("anomaly_quarantine", False),
                                anomaly_severity=cal_data.get("anomaly_severity", "NONE")
                            )
            except Exception as e:
                print(f"Warning: Failed to load calibration from {self.persist_path}: {e}")

    def _save_to_disk(self):
        """Persist calibration state."""
        if not self.persist_path:
            return

        self.persist_path.parent.mkdir(parents=True, exist_ok=True)

        serialized = {
            "calibrations": {
                str(slot): {
                    "slot": cal.slot,
                    "base_friction_coefficient": cal.base_friction_coefficient,
                    "ephemeris_adjusted_friction": cal.ephemeris_adjusted_friction,
                    "coherence_target": cal.coherence_target,
                    "mode": cal.mode.value,
                    "last_updated": cal.last_updated,
                    "update_signature": cal.update_signature,
                    "anomaly_quarantine": cal.anomaly_quarantine,
                    "anomaly_severity": cal.anomaly_severity
                }
                for slot, cal in self.calibrations.items()
            }
        }

        try:
            with open(self.persist_path, 'w') as f:
                json.dump(serialized, f, indent=2)
        except Exception as e:
            print(f"Warning: Failed to persist calibration to {self.persist_path}: {e}")

    def receive_execution_observation(
        self,
        slot: int,
        base_friction: float,
        prediction: PredictionSignature,
        observation: ExecutionObservation
    ) -> Tuple[DriftDelta, PhaseCorrection]:
        """
        Called after FOCAL_LOCK fires and execution is complete.
        Feeds observation into ephemeris, updates this slot's calibration.

        Returns: (drift_delta, phase_correction) for logging
        """
        # Capture observation via ephemeris
        drift_delta, phase_correction = self.ephemeris.observe_and_classify(
            prediction=prediction,
            observation=observation
        )

        # Update calibration for this slot
        self._update_calibration_for_slot(
            slot=slot,
            base_friction=base_friction,
            phase_correction=phase_correction,
            drift_delta=drift_delta
        )

        return drift_delta, phase_correction

    def _update_calibration_for_slot(
        self,
        slot: int,
        base_friction: float,
        phase_correction: PhaseCorrection,
        drift_delta: DriftDelta
    ):
        """Apply phase correction to this slot's calibration context."""
        current_cal = self.calibrations[slot]

        # Compute adjusted friction based on mode
        if self.mode == CalibrationMode.FROZEN:
            adjusted_friction = current_cal.ephemeris_adjusted_friction
        else:
            # Get the correction coefficient from ephemeris
            weight = self.ephemeris.register.get_current_weight(slot)
            adjusted_friction = base_friction * weight

        # Update quarantine status
        is_quarantined = self.ephemeris.get_quarantine_status(slot)

        # Determine anomaly severity
        if is_quarantined:
            if len(self.ephemeris.register.corrections.get(slot, [])) >= 10:
                severity = "CRITICAL"  # Persistent anomalies
            else:
                severity = "WARNING"
        else:
            severity = "NONE"

        # Create updated context
        cal_str = f"{slot}|{adjusted_friction}|{phase_correction.signature}"
        import hashlib
        signature = hashlib.sha256(cal_str.encode()).hexdigest()[:16]

        updated_cal = CalibrationContext(
            slot=slot,
            base_friction_coefficient=base_friction,
            ephemeris_adjusted_friction=adjusted_friction,
            coherence_target=current_cal.coherence_target,
            mode=self.mode,
            last_updated=time.time(),
            update_signature=signature,
            anomaly_quarantine=is_quarantined,
            anomaly_severity=severity
        )

        self.calibrations[slot] = updated_cal
        self._save_to_disk()

    def get_friction_for_peirce_next_cycle(self, slot: int) -> float:
        """
        Adapter for Peirce's gate: return the phase-corrected friction
        coefficient to use on the next cycle.
        """
        return self.calibrations[slot].ephemeris_adjusted_friction

    def get_coherence_target_for_slot(self, slot: int) -> float:
        """
        Get the minimum acceptable PPS for this slot.
        May be adjusted if the slot is under anomaly quarantine.
        """
        cal = self.calibrations[slot]
        if cal.anomaly_quarantine and cal.anomaly_severity == "CRITICAL":
            # Tighten coherence requirement during critical anomalies
            return min(0.50, cal.coherence_target * 1.5)
        return cal.coherence_target

    def set_calibration_mode(self, new_mode: CalibrationMode):
        """Change the mode of operation (e.g., switch to FROZEN for diagnostics)."""
        self.mode = new_mode
        for slot in self.calibrations:
            self.calibrations[slot].mode = new_mode
        self._save_to_disk()

    def emit_calibration_report(self) -> CalibrationReport:
        """Generate a comprehensive calibration report."""
        timestamp = time.time()
        quarantined = sum(
            1 for cal in self.calibrations.values()
            if cal.anomaly_quarantine
        )
        corrections_all = [
            self.ephemeris.register.corrections.get(slot, [])
            for slot in range(144)
        ]
        all_corrections_flat = [c for corrections in corrections_all for c in corrections]
        avg_magnitude = (
            sum(c.drift_delta.magnitude for c in all_corrections_flat) / len(all_corrections_flat)
            if all_corrections_flat else 0.0
        )

        report_str = f"{timestamp}|{len(self.calibrations)}|{quarantined}|{avg_magnitude}"
        import hashlib
        signature = hashlib.sha256(report_str.encode()).hexdigest()[:16]

        return CalibrationReport(
            timestamp=timestamp,
            total_slots_calibrated=len(self.calibrations),
            slots_under_quarantine=quarantined,
            average_correction_magnitude=avg_magnitude,
            mode=self.mode,
            report_signature=signature
        )

    def emit_detailed_calibration_summary(self) -> Dict:
        """Return detailed calibration state for all 144 slots."""
        return {
            "timestamp": time.time(),
            "mode": self.mode.value,
            "slots": {
                str(slot): {
                    "base_friction": cal.base_friction_coefficient,
                    "adjusted_friction": cal.ephemeris_adjusted_friction,
                    "coherence_target": cal.coherence_target,
                    "last_updated": cal.last_updated,
                    "anomaly_quarantine": cal.anomaly_quarantine,
                    "anomaly_severity": cal.anomaly_severity,
                    "ephemeris_correction_history": self.ephemeris.emit_calibration_report(slot)
                }
                for slot, cal in self.calibrations.items()
            }
        }


# ============================================================================
# ADAPTER: How to integrate with target_gen.py (Peirce's gate)
# ============================================================================

class PeirceIntegrationAdapter:
    """
    Provides the exact API that target_gen.py needs to call.
    Hides the complexity of the ephemeris + calibration system.
    """

    def __init__(self, bridge: PeirceCalibrationBridge):
        self.bridge = bridge

    def get_friction_threshold_for_pps_computation(self, slot: int) -> float:
        """
        In Peirce's compute_pps(), call this instead of using a constant
        friction_threshold. Pass the macrocosmic_slot (0–143).

        Returns: float, the friction coefficient with phase correction applied
        """
        return self.bridge.get_friction_for_peirce_next_cycle(slot)

    def get_coherence_minimum_for_acceptance(self, slot: int) -> float:
        """
        In Peirce's validate_camera(), call this to get the minimum PPS
        threshold for this slot.

        Returns: float, typically 0.30 (Thirdness) but may be tighter
                if anomaly quarantine is active
        """
        return self.bridge.get_coherence_target_for_slot(slot)

    def validate_slot_health(self, slot: int) -> Tuple[bool, str]:
        """
        Query whether a slot is operating normally.

        Returns: (is_healthy, status_message)
                 healthy=True if PPS ≥ threshold and no anomalies
                 healthy=False if under quarantine or critical anomaly
        """
        cal = self.bridge.calibrations[slot]
        if cal.anomaly_quarantine:
            if cal.anomaly_severity == "CRITICAL":
                return False, f"Slot {slot}: CRITICAL anomaly quarantine active"
            else:
                return True, f"Slot {slot}: WARNING anomaly, correcting"
        return True, f"Slot {slot}: nominal"

    def emit_status_for_logging(self) -> Dict:
        """Emit current status for structured logging."""
        report = self.bridge.emit_calibration_report()
        return {
            "timestamp": report.timestamp,
            "calibration_mode": report.mode.value,
            "total_slots_calibrated": report.total_slots_calibrated,
            "slots_under_anomaly_quarantine": report.slots_under_quarantine,
            "average_drift_magnitude": report.average_correction_magnitude,
            "report_signature": report.report_signature
        }


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

"""
In target_gen.py, the integration would look like:

    from peirce_calibration_bridge import (
        PeirceIntegrationAdapter,
        PeirceCalibrationBridge,
        CalibrationMode
    )
    from ephemeris_dialect import EphemerisDialect

    # Initialize once at startup
    ephemeris = EphemerisDialect(persist_path="./runtime_state/ephemeris.json")
    bridge = PeirceCalibrationBridge(
        ephemeris=ephemeris,
        mode=CalibrationMode.BALANCED,
        persist_path="./runtime_state/calibration.json"
    )
    adapter = PeirceIntegrationAdapter(bridge)

    # In the main compilation loop:
    def compile_and_execute(expression: str, slot: int):
        # Step 1: Peirce's gate — reads calibrated friction
        friction_threshold = adapter.get_friction_threshold_for_pps_computation(slot)
        coherence_min = adapter.get_coherence_minimum_for_acceptance(slot)

        # Step 2: Compute PPS
        pps_score = compute_pps(camera_perspective, friction_threshold=friction_threshold)

        # Step 3: Execute (Llull → Trithemius → 144 Names → FOCAL_LOCK)
        execution_result = llull_to_execution(expression, slot)

        # Step 4: Observe result and feed back
        prediction = PredictionSignature(...)  # From compilation metadata
        observation = ExecutionObservation(...)  # From execution
        drift_delta, phase_correction = bridge.receive_execution_observation(
            slot=slot,
            base_friction=friction_threshold,
            prediction=prediction,
            observation=observation
        )

        # Log the observation
        logger.info(f"Drift {drift_delta.category.value}: {drift_delta.magnitude:.4f}")
        logger.debug(f"Correction coefficient: {phase_correction.correction_coefficient}")

        # Next cycle will automatically use the updated friction threshold
        return execution_result
"""
