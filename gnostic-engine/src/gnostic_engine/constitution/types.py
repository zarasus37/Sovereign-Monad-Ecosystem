"""Constitution scorer input types (Layer 7.3) — Python mirror of the TS
``@sovereign/ttcl`` ``Sign``/``PeirceSignature``/``EventTrace`` shapes.

These are kept as plain frozen dataclasses (no pydantic) so the scorer and its
parity tests have no heavy deps. The orchestrator
(``gnostic_engine.orchestration.sign_builder``) constructs these from a
gnosis packet; the scorer reads them. See the TS reference in
``monad-ecosystem/packages/ttcl/src/runtime/constitution.ts`` and
``monad-ecosystem/packages/ttcl/src/types.ts``.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Literal, Optional, Sequence

Domain = Literal["THEOLOGY", "TECHNOLOGY", "COSMOLOGY"]
Modality = Literal["PURE", "ICON", "INDEX", "SYMBOL", "HYBRID"]
PragmatismBand = Literal["INSTINCT", "EXPERIENCE", "FORMAL_THOUGHT"]
CoarseMode = Literal["ICON", "INDEX", "SYMBOL"]


@dataclass(frozen=True)
class EventTrace:
    """Mirrors CHARTER §4 EventTrace — only ``source`` is read by the scorer."""

    intention_id: str
    source: Optional[str] = None
    parent_event_id: Optional[str] = None
    constraint_envelope_id: Optional[str] = None
    narrative_purpose_id: Optional[str] = None
    created_at: Optional[str] = None


@dataclass(frozen=True)
class PeirceSignature:
    """Mirrors ``logoc/src/peirce/models.ts`` PeirceSignature. The scorer reads
    ``sign_class_id`` (C3 manifold validation) and ``pragmatism_band`` (C4)."""

    mode: CoarseMode
    sign_class_id: int
    sign_class_label: str
    path: List[str]
    firstness_weight: float
    secondness_weight: float
    thirdness_weight: float
    pragmatism_band: PragmatismBand


@dataclass(frozen=True)
class Sign:
    """Mirrors the TTCL ``Sign<M,T>``. ``domains`` is the triadic compose
    ancestry (None → single-domain); ``no_rlhf`` defaults to True when None."""

    modality: Modality
    domain: Domain
    pps: float
    peirce: PeirceSignature
    trace: Optional[EventTrace] = None
    # `None` (not []) means "no compose ancestry" vs an explicit empty list,
    # matching TS `sign.domains ?? [sign.domain]` nullish semantics.
    domains: Optional[Sequence[Domain]] = None
    no_rlhf: Optional[bool] = None