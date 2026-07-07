"""Gnostic Engine classification seam (Layer 7).

Ports the TS heuristic Peirce classifier (`logoc/src/peirce/classifier.ts`)
to Python and reuses the canonical Python LOGOC manifold mirror
(`monad-ecosystem/packages/logoc/peirce/manifold.py`) via a sys.path seam.

Parity is against the TS heuristic — NOT the richer YAML-rubric
`logoc/peirce/classifier.py` (which reads `peirce_rules.yml` with
disambiguation weights, strong indicators, and permutation fallbacks).
The rubric classifier is documentation-grade until a future layer promotes
both runtimes to YAML-driven parity. See the Layer 7 plan, risk (4).
"""

from .heuristic import (
    AmbiguousClassificationError,
    HeuristicClassifier,
    ClassifierInput,
    PeirceSignatureOutput,
    SemioticFlags,
    infer_coarse_mode,
)
from ._manifold_proxy import get_manifold, PeirceManifold, PeirceSignClass

__all__ = [
    "AmbiguousClassificationError",
    "HeuristicClassifier",
    "ClassifierInput",
    "PeirceSignatureOutput",
    "SemioticFlags",
    "infer_coarse_mode",
    "get_manifold",
    "PeirceManifold",
    "PeirceSignClass",
]