# archive/legacy-workspaces/legacy-monad-ecosystem-workspace/compiler/ephemeris_dialect.py
# Compatibility shim to map peirce_calibration_bridge imports to ephemeris_dialect_hardened

from ephemeris_dialect_hardened import EphemerisDialect, DriftCategory, DriftObservation, AnomalyRecord

class DriftDelta:
    """Mock DriftDelta representation expected by Peirce bridge type hints."""
    def __init__(self, category=None, magnitude=0.0):
        self.category = category
        self.magnitude = magnitude

class PhaseCorrection:
    """Mock PhaseCorrection representation expected by Peirce bridge type hints."""
    def __init__(self, signature="", correction_coefficient=1.0):
        self.signature = signature
        self.correction_coefficient = correction_coefficient

class PredictionSignature:
    """Mock PredictionSignature representation expected by Peirce bridge type hints."""
    pass

class ExecutionObservation:
    """Mock ExecutionObservation representation expected by Peirce bridge type hints."""
    pass


