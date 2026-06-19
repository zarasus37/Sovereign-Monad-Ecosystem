import os

LOCK_THRESHOLD = float(os.getenv("SGE_STRUCT_READ_THRESHOLD", "0.85"))


def compute_structural_read(payload: dict) -> float:
    """Compute simplified Structural Read: DoP * Pulfrich - W

    Payload expected shape (minimal):
      { "meta": { "DoP": 0.0, "Pulfrich": 1.0, "W": 0.0 } }

    This is a deterministic, testable placeholder for the full SGE math.
    """
    meta = payload.get("meta", {})
    try:
        DoP = float(meta.get("DoP", 0.0))
        Pulfrich = float(meta.get("Pulfrich", 1.0))
        W = float(meta.get("W", 0.0))
    except Exception:
        DoP, Pulfrich, W = 0.0, 1.0, 0.0
    score = DoP * Pulfrich - W
    return round(score, 6)
