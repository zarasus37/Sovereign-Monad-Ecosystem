"""
Generated canonical numerics (Layer 4a).

This package holds the codegen output of
`monad-ecosystem/packages/ttcl/scripts/gen-numerics.mjs` — the Python mirror of
`shared/schemas/ttcl-numerics.json`. Do not edit `numerics.py` by hand; edit the
JSON and re-run the generator. Drift is caught by
`scripts/check-numeric-drift.mjs`.
"""
from .numerics import (  # noqa: F401 — re-exported for ergonomic imports
    FOCAL_LOCK_THRESHOLD,
    BOUNDARY_THRESHOLD,
    LANE_B_BLEND_RAW_WEIGHT,
    LANE_B_BLEND_VMASK_WEIGHT,
    LANE_C_KILL_RHCP_SPIN,
    LANE_C_KILL_HOST_RATIO,
    LANE_C_KILL_USER_RATIO,
    SPIN_EXPANDING_GATE,
    MAX_BLINKS,
    MAX_TVL_REFERENCE,
    TTCL_NUMERICS,
)