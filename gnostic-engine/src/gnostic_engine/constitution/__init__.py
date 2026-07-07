"""Constitution scorer — Python parity mirror of the canonical TS
``@sovereign/ttcl`` ``scoreSign`` (Layer 7.3).

The TS scorer remains the canonical reference; this mirror is parity-tested
against it (same pattern as the canonical numerics). The orchestrator that
holds a ``Sign`` calls ``score_sign``; the LOGOC classifier feeds it via the
``peirce`` field. The scorer lives here (not in LOGOC) because its inputs
(triadic ancestry, modality, the ``no_rlhf`` flag) are TTCL ``Sign`` concepts.
"""
from .types import (
    Domain,
    EventTrace,
    Modality,
    PeirceSignature,
    PragmatismBand,
    CoarseMode,
    Sign,
)
from .scorer import (
    ConstitutionCriterion,
    ConstitutionResult,
    score_sign,
)

__all__ = [
    "Domain",
    "EventTrace",
    "Modality",
    "PeirceSignature",
    "PragmatismBand",
    "CoarseMode",
    "Sign",
    "ConstitutionCriterion",
    "ConstitutionResult",
    "score_sign",
]