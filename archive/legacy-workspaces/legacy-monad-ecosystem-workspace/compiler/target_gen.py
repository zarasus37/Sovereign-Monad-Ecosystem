import time
from typing import Dict, Any, Tuple

# ── LAYER 4 ANTIKYTHERA ─────────────────────────────────────────
from peirce_calibration_bridge import (
    PeirceIntegrationAdapter,
    PeirceCalibrationBridge,
    CalibrationMode,
)
from ephemeris_dialect_hardened import EphemerisDialect

# Monkeypatch to resolve existing class naming mismatch in compiler package
try:
    import compiler.provenance as _provenance
    _provenance.ProvenanceWrapper = _provenance.ProvenanceDialect
except (ImportError, AttributeError):
    pass

class PipelineHaltException(Exception):
    """Raised when Layer 4 Tier 3 halt is triggered by systemic anomaly."""
    pass

class TargetGenerator:
    """
    Level 0: Target Generation (Peircean Execution Gate)
    The final exit node of the compiler stack. Evaluates Peircean camera
    perspectives, calculates PPS, and emits secure execution targets.
    """
    def __init__(self):
        print("[Compiler Core] Level 0 TargetGenerator online. Triadic minimal gates armed.")
        # ── ADDITION 1: Initialize Layer 4 Antikythera Epicyclic Correction ──
        import pathlib
        _state_path = pathlib.Path(".runtime_state")
        _state_path.mkdir(parents=True, exist_ok=True)
        (_state_path / "slot_profiles").mkdir(parents=True, exist_ok=True)

        self.ephemeris = EphemerisDialect(
            wal_path=str(_state_path / "wal.log"),
            slot_profile_path=str(_state_path / "slot_profiles"),
        )
        self.bridge = PeirceCalibrationBridge(
            ephemeris=self.ephemeris,
            mode=CalibrationMode.FROZEN,
            persist_path=str(_state_path / "calibration.json"),
        )
        self.adapter = PeirceIntegrationAdapter(self.bridge)
        self.cycle_counter = 0
        import logging as _logging
        _logging.getLogger(__name__).info(
            "TargetGenerator initialized with Layer 4 Antikythera | mode=FROZEN | state_path=.runtime_state"
        )
        
        # Ensure wal.log exists and save default slot profiles to disk
        (_state_path / "wal.log").touch()
        for slot, profile in self.ephemeris.slot_profiles.items():
            profile._save_to_disk()
        # Clean desktop.ini if Windows/Google Drive created it, so count is exactly 144
        try:
            import os as _os
            _os.remove(str(_state_path / "slot_profiles" / "desktop.ini"))
        except OSError:
            pass

    @staticmethod
    def validate_camera_perspective(camera: str) -> bool:
        """
        Enforces the primary cosmic design rule: No dyads allowed.
        Perspective must be a pure Monad (1 unique state like EEE) or
        a fully differentiated Triad (3 unique states like ABC).
        """
        if not isinstance(camera, str):
            return False
            
        clean_camera = camera.strip().upper()
        if len(clean_camera) != 3:
            print(f"[Peircean Gate] Structural Error: Camera length is {len(clean_camera)}, must be 3.")
            return False

        distinct_count = len(set(clean_camera))
        
        # Explicit Dyadic Intercept (Exactly 2 unique properties e.g., AAB, ABB)
        if distinct_count == 2:
            print(f"[Peircean Gate] !!! DYADIC COLLAPSE !!! Asymmetric reduction forbidden in '{clean_camera}'.")
            return False
            
        return distinct_count in {1, 3}

    def compute_pps(self, perspective: str, macrocosmic_slot: int) -> float:
        """
        Calculates the exact Peircean Perspective Purity Score (PPS).
        PPS = 1.00 when all components match (Maximum Coherence / Monad).
        PPS = 0.30 when all components vary (Balanced Triadic Tension).
        """
        # ADDITION 2: Read phase-corrected friction threshold from Layer 4
        friction_threshold = self.adapter.get_friction_threshold_for_pps_computation(macrocosmic_slot)

        if not TargetGenerator.validate_camera_perspective(perspective):
            return 0.0
            
        clean_persp = perspective.strip().upper()
        distinct_count = len(set(clean_persp))
        
        if distinct_count == 1:
            pps = 1.00  # Pure unified insight state
        else:
            pps = 0.30      # Differentiated analytical state

        coherence_index = pps - friction_threshold
        return max(0.0, coherence_index)

    def compile_to_backend_target(self, provenance_package: Dict[str, Any], camera_perspective: str, expression: str = "") -> Dict[str, Any]:
        """
        Executes the final lowering pass. Bridges Level 1 provenance containers
        with Level 0 execution targets based on Peircean semiotic verification.
        """
        print(f"\n[Target Gen] Intercepting sealed container for final compilation gate...")
        
        # 1. Enforce strict Triadic Gate verification
        if not self.validate_camera_perspective(camera_perspective):
            return {
                "status": "TARGET_COMPILE_FAILED",
                "error_vector": "Peircean Triadic Gate Exception: Dyadic Collapse or Structural Failure."
            }
            
        # 3. Inherit and unpack verified upstream data from your provenance layers
        inherited_envelope = provenance_package.get("encapsulated_state", {})
        isolated_rail = inherited_envelope.get("isolated_data_rail", {})
        macrocosmic_slot = inherited_envelope.get("macrocosmic_slot_target", 0)
        
        # 2. Extract structural metrics
        pps_score = self.compute_pps(camera_perspective, macrocosmic_slot)
        semiotic_mode = "SYMBOL" if pps_score == 1.00 else "INDEX"
        
        print(f"[Target Gen] Gate passed. Semiotic Target Mode: {semiotic_mode} | Computed PPS: {pps_score:.2f}")
        
        # 4. Emit the finalized, optimized execution block for the downstream submodules
        finalized_monad_target = {
            "status": "TARGET_LOCKED_FOR_EXECUTION",
            "compilation_timestamp_ns": time.time_ns(),
            "semiotic_execution_mode": semiotic_mode,
            "peircean_metrics": {
                "pps_purity_score": pps_score,
                "inherited_friction_floor": inherited_envelope.get("pps_score_inheritance", 0.0)
            },
            "immutable_execution_payload": {
                "bytecode_alias": isolated_rail.get("bytecode_alias", "NULL_OP"),
                "macrocosmic_slot_target": macrocosmic_slot,
                "trithemius_lock_signature": provenance_package.get("trithemius_cipher_signature", "UNSIGNED")
            }
        }
        
        # Create output signature for execution result
        import hashlib as _hashlib
        _payload_str = str(finalized_monad_target["immutable_execution_payload"])
        finalized_monad_target["output_signature"] = _hashlib.sha256(_payload_str.encode()).hexdigest()
        
        execution_result = finalized_monad_target
        if not expression:
            expression = camera_perspective

        # ADDITION 3: Layer 4 observation and feedback loop
        self.cycle_counter += 1
        _cycle_id = f"CYCLE-{self.cycle_counter}"
        friction_threshold = self.adapter.get_friction_threshold_for_pps_computation(macrocosmic_slot)
        _observed_friction = self.compute_observed_friction(
            expected_sig=_hashlib.sha256(expression.encode()).hexdigest(),
            actual_sig=execution_result.get("output_signature", ""),
        )
        _drift_obs, _anomaly_record = self.ephemeris.observe_and_classify(
            slot=macrocosmic_slot,
            predicted_friction=friction_threshold,
            observed_friction=_observed_friction,
            cycle_id=_cycle_id,
            execution_output=execution_result,
        )
        
        # Auto-trigger guard: switch from FROZEN to BALANCED after 100 cycles
        if self.cycle_counter == 100 and self.bridge.mode == CalibrationMode.FROZEN:
            import json
            audit = self.ephemeris.emit_full_audit_report()
            # Log it so you have the frozen-period baseline on disk
            with open('.runtime_state/frozen_period_audit.json', 'w') as f:
                json.dump(audit, f, indent=2)
            print("[ANTIKYTHERA] 100 stable cycles complete. Switching to BALANCED.")
            self.bridge.set_calibration_mode(CalibrationMode.BALANCED)

        import logging as _logging
        _logging.getLogger(__name__).info(
            f"Drift classified: {_drift_obs.category.value} | delta={_drift_obs.delta:.4f}"
        )
        if self.ephemeris.containment.is_pipeline_halted():
            _audit = self.ephemeris.emit_full_audit_report()
            _logging.getLogger(__name__).critical(f"TIER 3 HALT — {_audit}")
            raise PipelineHaltException(
                f"Layer 4 Tier 3 halt triggered. Manual intervention required. Audit: {_audit}"
            )
        if _anomaly_record:
            _logging.getLogger(__name__).warning(
                f"ANOMALY TIER {_anomaly_record.tier.value}: {_anomaly_record.action_taken}"
            )
            
        print("[Target Gen] Monad execution target finalized and locked.")
        return finalized_monad_target

    def compute_observed_friction(self, expected_sig: str, actual_sig: str) -> float:
        """Estimate observed friction from execution signature divergence (Hamming distance)."""
        if len(expected_sig) != len(actual_sig):
            hamming = max(len(expected_sig), len(actual_sig))
        else:
            hamming = sum(1 for a, b in zip(expected_sig, actual_sig) if a != b)
        max_hamming = len(expected_sig) if expected_sig else 1
        return (hamming / max_hamming) * 0.5

# ==========================================
# LOCAL TARGET-GEN VERIFICATION SUITE
# ==========================================
if __name__ == "__main__":
    generator = TargetGenerator()
    
    # Mocking data sealed by your Level 1 Provenance engine module
    mock_provenance_input = {
        "container_header": "SHEM_ANGEL_BOUND_WRAPPER",
        "trithemius_cipher_signature": "KREHQHV_VWUHDP_LQWDNH",
        "encapsulated_state": {
            "macrocosmic_slot_target": 72,
            "pps_score_inheritance": 0.95,
            "isolated_data_rail": {"bytecode_alias": "REVENUE_STREAM_INTAKE"}
        }
    }
    
    # Test Pass 1: Maximum Coherence Monad perspective (EEE)
    print("--- RUNNING GATE PASS 1 (MAX COHERENCE) ---")
    output_a = generator.compile_to_backend_target(mock_provenance_input, camera_perspective="EEE")
    
    # Test Pass 2: Critical Failure due to Dyadic Collapse configuration (ABB)
    print("\n--- RUNNING GATE PASS 2 (DYADIC EXPLOTIATION REJECT) ---")
    output_b = generator.compile_to_backend_target(mock_provenance_input, camera_perspective="ABB")
