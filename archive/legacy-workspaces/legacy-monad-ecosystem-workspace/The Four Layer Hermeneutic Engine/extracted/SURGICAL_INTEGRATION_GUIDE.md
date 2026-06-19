# TARGET_GEN.PY SURGICAL INTEGRATION GUIDE
**Exact code locations, line numbers, and surgical modifications**

---

## PRE-INTEGRATION CHECKLIST

Before you touch `target_gen.py`:

- [ ] Backup: `cp compiler/target_gen.py compiler/target_gen.py.backup`
- [ ] Copy Layer 4 modules to working directory:
  - `ephemeris_dialect_hardened.py` → `compiler/`
  - `peirce_calibration_bridge.py` → `compiler/`
- [ ] Create runtime directory: `mkdir -p ./runtime_state/slot_profiles`
- [ ] Have this guide open alongside your editor

---

## ADDITION 1: IMPORTS & INITIALIZATION

### Location 1A: Top of File (After Existing Imports)

**File:** `compiler/target_gen.py`  
**Location:** After all existing imports (typically after `logging`, `typing`, `pathlib`, etc.)  
**Action:** Add these three lines

```python
# [LAYER 4 ANTIKYTHERA] Imports
from peirce_calibration_bridge import (
    PeirceIntegrationAdapter,
    PeirceCalibrationBridge,
    CalibrationMode
)
from ephemeris_dialect_hardened import EphemerisDialect
```

**Example (if your existing imports end at line 20):**
```python
# Lines 1–20: Existing imports (logging, typing, pathlib, etc.)
import logging
from typing import Dict, Optional, Tuple
from pathlib import Path

# [LAYER 4 ANTIKYTHERA] Imports   ← ADD FROM HERE
from peirce_calibration_bridge import (
    PeirceIntegrationAdapter,
    PierceCalibrationBridge,
    CalibrationMode
)
from ephemeris_dialect_hardened import EphemerisDialect
# ← TO HERE
```

---

### Location 1B: TargetGenerator.__init__() Method

**File:** `compiler/target_gen.py`  
**Location:** Inside `TargetGenerator.__init__()`, at the END of the method (just before the closing of `__init__`)  
**Action:** Add Layer 4 initialization block

```python
# [ADDITION 1] Initialize Layer 4: Antikythera Epicyclic Correction
self.ephemeris = EphemerisDialect(
    wal_path="./runtime_state/wal.log",
    slot_profile_path="./runtime_state/slot_profiles"
)

self.bridge = PeirceCalibrationBridge(
    ephemeris=self.ephemeris,
    mode=CalibrationMode.BALANCED,
    persist_path="./runtime_state/calibration.json"
)

self.adapter = PeirceIntegrationAdapter(self.bridge)
self.cycle_counter = 0

logger.info(
    "TargetGenerator initialized with Layer 4 Antikythera "
    "(mode=BALANCED, state_path=./runtime_state)"
)
```

**Example (if TargetGenerator.__init__() currently ends at line 60):**
```python
def __init__(self, base_friction_threshold: float = 0.5):
    """Initialize TargetGenerator."""
    self.base_friction_threshold = base_friction_threshold
    
    # Existing initialization code
    self.cache = {}
    
    # [ADDITION 1] Initialize Layer 4: Antikythera Epicyclic Correction   ← ADD FROM HERE
    self.ephemeris = EphemerisDialect(
        wal_path="./runtime_state/wal.log",
        slot_profile_path="./runtime_state/slot_profiles"
    )
    
    self.bridge = PeirceCalibrationBridge(
        ephemeris=self.ephemeris,
        mode=CalibrationMode.BALANCED,
        persist_path="./runtime_state/calibration.json"
    )
    
    self.adapter = PeirceIntegrationAdapter(self.bridge)
    self.cycle_counter = 0
    
    logger.info(
        "TargetGenerator initialized with Layer 4 Antikythera "
        "(mode=BALANCED, state_path=./runtime_state)"
    )
    # ← TO HERE
```

---

## ADDITION 2: PHASE-CORRECTED FRICTION THRESHOLD

### Location 2: Inside compute_pps() Method

**File:** `compiler/target_gen.py`  
**Location:** Inside `compute_pps()` method, find the line that reads the friction threshold  
**Action:** Replace static threshold with adapter call

**BEFORE (your current code):**
```python
def compute_pps(self, perspective: str, macrocosmic_slot: int) -> float:
    """Compute Peircean Perspective Purity Score."""
    
    # FIND THIS LINE:
    friction_threshold = self.base_friction_threshold  # ← OLD
    
    # Rest of method...
```

**AFTER (modified):**
```python
def compute_pps(self, perspective: str, macrocosmic_slot: int) -> float:
    """Compute Peircean Perspective Purity Score."""
    
    # [ADDITION 2] Read phase-corrected friction threshold
    friction_threshold = self.adapter.get_friction_threshold_for_pps_computation(
        macrocosmic_slot
    )  # ← NEW (replaces: friction_threshold = self.base_friction_threshold)
    
    # Rest of method continues unchanged...
```

**Important:** 
- Replace the entire line that says `friction_threshold = self.base_friction_threshold`
- Do NOT modify anything else in compute_pps()
- The rest of the PPS logic (triadic gate, dyadic rejection) stays unchanged
- Only this one threshold value changes

---

## ADDITION 3: OBSERVATION & FEEDBACK LOOP

### Location 3A: After FOCAL_LOCK Execution

**File:** `compiler/target_gen.py`  
**Location:** Immediately after the block where `FOCAL_LOCK` fires and `execution_result` is available  
**Action:** Add observation and containment check

**BEFORE (your current code):**
```python
def some_compilation_method(self, ...):
    # ... compilation code ...
    
    # FOCAL_LOCK execution
    execution_result = self.focal_lock(expression, state_token, keycap)
    logger.info(f"Execution complete: {execution_result}")
    
    # FIND THIS POINT ← your code probably ends here or returns here
    return execution_result
```

**AFTER (modified):**
```python
def some_compilation_method(self, ...):
    # ... compilation code ...
    
    # FOCAL_LOCK execution
    execution_result = self.focal_lock(expression, state_token, keycap)
    logger.info(f"Execution complete: {execution_result}")
    
    # [ADDITION 3] Observation and feedback loop   ← ADD FROM HERE
    self.cycle_counter += 1
    
    drift_obs, anomaly_record = self.ephemeris.observe_and_classify(
        slot=macrocosmic_slot,
        predicted_friction=friction_threshold,
        observed_friction=self._compute_observed_friction(
            expected_sig=metadata['expected_behavior_signature'],
            actual_sig=execution_result['output_signature']
        ),
        cycle_id=f"CYCLE-{self.cycle_counter}",
        execution_output=execution_result
    )
    
    logger.info(
        f"Drift classified: {drift_obs.category.value} "
        f"(delta={drift_obs.delta:.4f})"
    )
    
    # Check for Tier 3 halt
    if self.ephemeris.containment.is_pipeline_halted():
        logger.critical("TIER 3 HALT: Pipeline halted due to systemic anomaly")
        raise PipelineHaltException("Tier 3 anomaly containment halt")
    
    # Log anomalies
    if anomaly_record:
        logger.warning(
            f"ANOMALY TIER {anomaly_record.tier.value}: "
            f"{anomaly_record.action_taken}"
        )
    # ← TO HERE
    
    return execution_result
```

### Location 3B: Add Exception Class

**File:** `compiler/target_gen.py`  
**Location:** Near the top, after imports, before TargetGenerator class definition  
**Action:** Define the halt exception

```python
class PipelineHaltException(Exception):
    """Raised when Layer 4 Tier 3 halt is triggered."""
    pass
```

**Example:**
```python
# Imports...
from peirce_calibration_bridge import ...

# [LAYER 4 ANTIKYTHERA] Exception class
class PipelineHaltException(Exception):
    """Raised when Layer 4 Tier 3 halt is triggered."""
    pass

# TargetGenerator class definition
class TargetGenerator:
    ...
```

---

## ADDITION 4: HELPER METHOD

### Location 4: Add _compute_observed_friction() Method

**File:** `compiler/target_gen.py`  
**Location:** Inside TargetGenerator class, at the end (before any __del__ or other dunder methods)  
**Action:** Add friction computation helper

```python
def _compute_observed_friction(
    self,
    expected_sig: str,
    actual_sig: str
) -> float:
    """
    Estimate observed friction coefficient from execution signature divergence.
    
    Computes Hamming distance between expected and actual bytecode signatures,
    normalized to friction scale (0.0–0.5).
    
    Args:
        expected_sig: SHA-256 of expected bytecode
        actual_sig: SHA-256 of actual execution output
        
    Returns:
        float: Observed friction (0.0 = perfect, 0.5 = completely divergent)
    """
    # Handle length mismatch
    if len(expected_sig) != len(actual_sig):
        hamming = max(len(expected_sig), len(actual_sig))
    else:
        # Count differing characters
        hamming = sum(1 for a, b in zip(expected_sig, actual_sig) if a != b)
    
    # Normalize to 0.0–0.5 friction range
    max_hamming = len(expected_sig) if expected_sig else 1
    divergence = (hamming / max_hamming) * 0.5
    
    return divergence
```

**Example (if your class ends around line 200):**
```python
class TargetGenerator:
    
    def __init__(self, ...):
        # ...
    
    def compute_pps(self, ...):
        # ...
    
    # ... other methods ...
    
    # [ADDITION 4] Add helper method here
    def _compute_observed_friction(self, expected_sig: str, actual_sig: str) -> float:
        """Estimate observed friction from signature divergence."""
        if len(expected_sig) != len(actual_sig):
            hamming = max(len(expected_sig), len(actual_sig))
        else:
            hamming = sum(1 for a, b in zip(expected_sig, actual_sig) if a != b)
        
        max_hamming = len(expected_sig) if expected_sig else 1
        divergence = (hamming / max_hamming) * 0.5
        
        return divergence
```

---

## VERIFICATION CHECKLIST

After you've made all four additions:

### Step 1: Syntax Check
```bash
python -m py_compile compiler/target_gen.py
# Should produce no output (success)
```

### Step 2: Import Check
```python
from compiler.target_gen import TargetGenerator, PipelineHaltException
# Should import without errors
```

### Step 3: Initialize
```python
gen = TargetGenerator()
# Should initialize without errors
# Should create ./runtime_state/ directory
```

### Step 4: Check Files Created
```bash
ls -la ./runtime_state/
# Should show: wal.log, calibration.json, slot_profiles/

ls ./runtime_state/slot_profiles/ | wc -l
# Should show: 144
```

### Step 5: Run Validator
```python
from antikythera_integration_guide import RuntimeValidator

RuntimeValidator.test_drift_classification()
# ✓ Should pass
```

---

## QUICK REFERENCE: WHAT WAS CHANGED

| Addition | What Changed | Where | Lines |
|----------|--------------|-------|-------|
| **1** | Added imports + initialization | Top of file + __init__() | ~5 imports + ~15 init lines |
| **2** | Friction threshold read | Inside compute_pps() | 1 line replaced |
| **3** | Observation call | After FOCAL_LOCK | ~20 lines added |
| **4** | Helper method | End of class | ~20 lines added |
| **Exception** | New exception class | Before TargetGenerator | ~3 lines |

**Total changes:** ~65 lines added/modified across 4 locations in ONE file.

**Unchanged:** Every other module in the ecosystem.

---

## COMMON MISTAKES TO AVOID

❌ **Mistake 1:** Forgetting to create `./runtime_state/` directory  
✅ **Fix:** `mkdir -p ./runtime_state/slot_profiles` before first run

❌ **Mistake 2:** Modifying PPS logic instead of just the threshold  
✅ **Fix:** Only change the ONE line where friction_threshold is read (Addition 2)

❌ **Mistake 3:** Placing Addition 3 in the wrong location (not after FOCAL_LOCK)  
✅ **Fix:** Addition 3 MUST be after execution_result is available

❌ **Mistake 4:** Forgetting to increment self.cycle_counter  
✅ **Fix:** First line of Addition 3 is `self.cycle_counter += 1`

❌ **Mistake 5:** Not catching PipelineHaltException in calling code  
✅ **Fix:** Wrap calls in try/except if you want to handle halts gracefully

---

## TESTING THE ADDITIONS

After integration, test with this minimal script:

```python
from compiler.target_gen import TargetGenerator

# Create generator
gen = TargetGenerator(base_friction_threshold=0.5)

# Run one cycle
try:
    result = gen.compile_and_execute("AAA")
    print(f"✓ Cycle 1 succeeded: {result}")
except Exception as e:
    print(f"✗ Cycle 1 failed: {e}")

# Check status
status = gen.get_runtime_status()
print(f"Status: {status}")

# Verify files were created
import os
assert os.path.exists('./runtime_state/wal.log'), "WAL not created"
assert len(os.listdir('./runtime_state/slot_profiles')) == 144, "Slot profiles not created"
print("✓ All files created correctly")
```

---

## IF YOU GET STUCK

**Q: ImportError: cannot import name 'ephemeris_dialect_hardened'**  
A: Copy `ephemeris_dialect_hardened.py` to the same directory as `target_gen.py`

**Q: FileNotFoundError: './runtime_state/wal.log'**  
A: Run `mkdir -p ./runtime_state/slot_profiles` before first cycle

**Q: PipelineHaltException raised**  
A: Tier 3 halt triggered. Check audit report and manually review.

**Q: Slot profiles directory empty**  
A: Wait for second cycle. Profiles initialize after first observe_and_classify() call.

**Q: AttributeError: 'NoneType' object has no attribute 'observe_and_classify'**  
A: self.ephemeris was not initialized. Check Addition 1 is in __init__()

---

## COMMIT MESSAGE TEMPLATE

```
Add Layer 4 (Antikythera) Epicyclic Correction to target_gen.py

- Addition 1: Initialize EphemerisDialect, PeirceCalibrationBridge, PeirceIntegrationAdapter
- Addition 2: Read phase-corrected friction threshold in compute_pps()
- Addition 3: Observe execution result after FOCAL_LOCK; close feedback loop
- Addition 4: Add _compute_observed_friction() helper method

Integration: Four surgical additions to one file. No other modules modified.
Testing: RuntimeValidator passes all drift classification, persistence, containment tests.
```

---

## NEXT STEPS

1. Make all four additions
2. Run syntax check (`python -m py_compile`)
3. Run validator tests
4. Deploy with CalibrationMode.FROZEN for 100+ cycles
5. Review audit reports
6. Switch to CalibrationMode.BALANCED
7. Monitor in production

---

**Status:** Ready for surgical integration  
**File:** compiler/target_gen.py  
**Additions:** 4 (imports, init, one line PPS, observation, exception, helper)  
**Risk Level:** Low (highly localized, immutable architecture)
