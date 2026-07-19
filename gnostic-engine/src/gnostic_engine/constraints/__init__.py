"""Theo-Techno-Cosmo enforceable constraints (system validity gates).

Orthogonal to ``gnostic_engine.constitution`` (Sign quality / C1–C5).

Authority:
  - docs/THEO_TECHNO_COSMO.md
  - shared/constraints/v*/ (immutable versioned packs)
"""

from .identity import (
    IdentityObservation,
    IdentityTracker,
    RefusalWindow,
    SovereigntyDebtLedger,
    fingerprint_drift,
)
from .loader import ConstraintPack, get_constraint_pack, load_constraint_pack, read_current_version
from .scorer import (
    TTCConstraintScorer,
    gate_ttc,
    get_ttc_scorer,
    reset_ttc_scorer,
    score_ttc,
)
from .types import (
    ActionEvidence,
    DomainResult,
    RuleVerdict,
    TTCGateError,
    TTCResult,
)
from .window_log import (
    TtcWindowEvent,
    TtcWindowMetrics,
    TtcWindowSnapshot,
    get_window_metrics,
    reset_window_metrics,
)

__all__ = [
    "ActionEvidence",
    "ConstraintPack",
    "DomainResult",
    "IdentityObservation",
    "IdentityTracker",
    "RefusalWindow",
    "RuleVerdict",
    "SovereigntyDebtLedger",
    "TTCConstraintScorer",
    "TTCGateError",
    "TTCResult",
    "TtcWindowEvent",
    "TtcWindowMetrics",
    "TtcWindowSnapshot",
    "fingerprint_drift",
    "gate_ttc",
    "get_constraint_pack",
    "get_ttc_scorer",
    "get_window_metrics",
    "load_constraint_pack",
    "read_current_version",
    "reset_ttc_scorer",
    "reset_window_metrics",
    "score_ttc",
]
