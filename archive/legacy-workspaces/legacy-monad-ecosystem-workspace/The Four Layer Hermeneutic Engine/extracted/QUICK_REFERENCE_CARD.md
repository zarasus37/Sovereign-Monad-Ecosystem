# ANTIKYTHERA QUICK REFERENCE CARD
**Integration Points & API Reference**

---

## 1. INITIALIZE (Startup)

```python
from ephemeris_dialect_hardened import EphemerisDialect
from peirce_calibration_bridge import PeirceCalibrationBridge, PeirceIntegrationAdapter, CalibrationMode

# Create Layer 4 components (once at startup)
ephemeris = EphemerisDialect(
    wal_path="./runtime_state/wal.log",
    slot_profile_path="./runtime_state/slot_profiles"
)

bridge = PeirceCalibrationBridge(
    ephemeris=ephemeris,
    mode=CalibrationMode.BALANCED,  # Options: FROZEN, CONSERVATIVE, BALANCED, AGGRESSIVE
    persist_path="./runtime_state/calibration.json"
)

adapter = PeirceIntegrationAdapter(bridge)
```

---

## 2. PEIRCE GATE (In target_gen.py)

```python
def compute_pps(camera_perspective: str, macrocosmic_slot: int) -> float:
    """Compute PPS with phase-corrected friction threshold."""
    
    # GET CORRECTED FRICTION THRESHOLD
    friction_threshold = adapter.get_friction_threshold_for_pps_computation(macrocosmic_slot)
    
    # Compute PPS as before, but use corrected friction
    distinct_count = len(set(camera_perspective.strip().upper()))
    
    if distinct_count == 1:
        pps = 1.00  # Firstness
    elif distinct_count == 3:
        pps = 0.30  # Thirdness — but now evaluated against corrected threshold
    else:
        return 0.0  # Dyad rejection (unchanged)
    
    # Apply friction (now corrected by Antikythera)
    coherence_index = pps - friction_threshold
    return max(0.0, coherence_index)
```

---

## 3. POST-EXECUTION OBSERVATION (After FOCAL_LOCK)

```python
from ephemeris_dialect_hardened import PredictionSignature, ExecutionObservation
import hashlib
import time

# Capture execution result
execution_result = focal_lock_result()

# Create prediction signature (metadata from compilation)
prediction = PredictionSignature(
    macrocosmic_slot=slot,
    pps_score=pps_score,
    semiotic_mode=semiotic_mode,  # "SYMBOL" or "INDEX"
    friction_coefficient=friction_threshold,
    expected_behavior_signature=hashlib.sha256(expected_bytecode).hexdigest()
)

# Create observation (from execution)
observation = ExecutionObservation(
    execution_timestamp=time.time(),
    execution_duration_ms=execution_result['duration_ms'],
    actual_behavior_signature=hashlib.sha256(actual_bytecode).hexdigest(),
    output_state_token=execution_result['state_token'],
    convergence_marker=execution_result['converged'],
    final_pps_score=execution_result.get('final_pps')
)

# FEED TO EPHEMERIS
drift_obs, anomaly_record = ephemeris.observe_and_classify(
    slot=slot,
    predicted_friction=friction_threshold,
    observed_friction=observed_friction,  # Computed from signature divergence
    cycle_id=f"CYCLE-{cycle_counter}",
    execution_output=execution_result
)

# LOG RESULT
if anomaly_record:
    logger.warning(f"ANOMALY TIER {anomaly_record.tier.value}: {anomaly_record.action_taken}")
    if ephemeris.containment.is_pipeline_halted():
        raise PipelineHaltException("Tier 3 halt: full audit required")
else:
    logger.info(f"Drift classified: {drift_obs.category.value}, delta={drift_obs.delta:.4f}")
```

---

## 4. DRIFT OBSERVATION PIPELINE

```
EXECUTION RESULT
    ↓
ephemeris.observe_and_classify()
    ↓
    ├─ Classify drift: WITHIN_VARIANCE (0.00–0.27)
    │                  SYSTEMATIC_DRIFT (0.28–0.71)
    │                  ANOMALOUS_DEVIATION (0.72+)
    │
    ├─ Record to WAL (write-ahead log)
    │
    ├─ Update SlotCorrectionProfile
    │
    └─ Check anomaly containment:
       ├─ Tier 1: First anomaly → quarantine output only
       ├─ Tier 2: Repeated anomaly → suspend slot, reroute
       └─ Tier 3: 3+ distinct slots → HALT pipeline
```

---

## 5. RECALIBRATION GATE

```python
# After observing drift
if ephemeris.should_recalibrate_peirce(slot):
    logger.info(f"Recalibrating Peirce for slot {slot}")
    # Bridge automatically updates calibration weights
    # Next cycle's friction_threshold will be corrected

# Recalibration only occurs if:
#   1. SYSTEMATIC_DRIFT category (0.28–0.71 delta)
#   2. 3+ consecutive SYSTEMATIC_DRIFT in rolling window of 9
#   3. NOT anomalous deviations
```

---

## 6. STATUS CHECKS (For Logging/Monitoring)

```python
# Check if pipeline is halted
if ephemeris.containment.is_pipeline_halted():
    # Tier 3: Stop processing, emit audit, await manual intervention
    audit = ephemeris.emit_full_audit_report()
    logger.critical(f"Pipeline halted: {audit}")

# Check if slot is suspended
if ephemeris.containment.is_slot_suspended(slot):
    # Tier 2: Reroute expression via Tabula Generalis
    neighbor_slot = tabula_generalis_resolve(slot)
    logger.warning(f"Slot {slot} suspended, rerouting to {neighbor_slot}")

# Check quarantine status
if output_id in ephemeris.containment.quarantined_outputs:
    # Tier 1: Output held for manual review
    quarantined = ephemeris.containment.get_quarantined_output(output_id)
    logger.warning(f"Output {output_id} quarantined for review")

# Get comprehensive status
status = adapter.emit_status_for_logging()
logger.info(f"Calibration status: {status}")
```

---

## 7. CLASSIFICATION REFERENCE

| Delta Range | Category | Action | Threshold |
|-------------|----------|--------|-----------|
| 0.00–0.27 | WITHIN_VARIANCE | Discard; no action | ≤ 0.28 |
| 0.28–0.71 | SYSTEMATIC_DRIFT | Accumulate; recalibrate if n≥3 | 0.28–0.72 |
| 0.72+ | ANOMALOUS_DEVIATION | Isolate; escalate through tiers | ≥ 0.72 |

**Why these numbers?**
- 0.72 = system's authenticity floor (agent alignment threshold)
- 0.28 = 1 - 0.72 (complement; point where variance becomes significant)
- Same numerology ensures self-consistency across the engine

---

## 8. MONITORING METRICS

```python
# Metrics to track continuously
metrics = {
    "cycle_completion_rate": cycles_per_minute,
    "drift_delta_distribution": histogram_of_magnitudes,
    "recalibration_frequency_per_slot": dict[slot_id, frequency],
    "quarantine_rate": outputs_quarantined_per_million,
    "suspended_slots_count": len(ephemeris.containment.suspended_slots),
    "pipeline_halt_count": count_of_tier3_events,
    "correction_coefficient_ranges": {slot: (min, max) for all 144 slots},
    "wal_file_size_mb": size_of_wal_log
}

# Alert thresholds
alerts = {
    "pipeline_halt": "CRITICAL",
    "quarantine_rate > 1/10K": "WARNING",
    "suspended_slots >= 5": "WARNING",
    "avg_drift_increasing": "WARNING"
}
```

---

## 9. INITIALIZATION EXAMPLE

```python
# Complete example: SovereignMonadRuntime from integration guide
from antikythera_integration_guide import SovereignMonadRuntime

runtime = SovereignMonadRuntime(
    wal_path="./runtime_state/wal.log",
    slot_profile_path="./runtime_state/slot_profiles",
    calibration_path="./runtime_state/calibration.json",
    calibration_mode="BALANCED"
)

# Run a complete cycle
execution_result, anomaly_record = runtime.run_cycle(expression="sample_input")

# Check status
status = runtime.emit_runtime_status()
```

---

## 10. CRITICAL CONSTRAINTS

✅ **NEVER bypass the 0.28/0.72 boundaries**
   - They are self-consistent with the system's numerology
   - Changing them requires changing agent authenticity floor

✅ **NEVER apply recalibration on single observation**
   - Minimum 3 consecutive SYSTEMATIC_DRIFT required
   - Prevents thrashing; ensures stability

✅ **NEVER auto-recover from Tier 3 halt**
   - Systemic anomalies require manual root cause analysis
   - Automatic recovery masks underlying problems

✅ **ALWAYS persist state before in-memory update**
   - WAL pattern guarantees crash recovery
   - No data loss on process failure

---

## INTEGRATION CHECKLIST

- [ ] Import modules in target_gen.py
- [ ] Initialize ephemeris, bridge, adapter at startup
- [ ] Modify compute_pps() to read friction from adapter
- [ ] Call observe_and_classify() after FOCAL_LOCK
- [ ] Check is_pipeline_halted(); raise exception if true
- [ ] Log drift classification and anomaly records
- [ ] Monitor quarantine rate and suspended slots
- [ ] Run RuntimeValidator tests before production
- [ ] Deploy with CalibrationMode.FROZEN first (observe-only)
- [ ] Switch to BALANCED after 100 stable cycles

---

**Version:** 1.0  
**Date:** June 10, 2026  
**Status:** Ready for integration
