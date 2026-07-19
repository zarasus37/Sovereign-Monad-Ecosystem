"""TTC constraint scorer input/output types.

Orthogonal to ``gnostic_engine.constitution`` (Sign quality C1–C5).
This module judges agent *action* validity under Theo-Techno-Cosmo:
sovereignty/refusal, structure, density/persistence.

See ``docs/THEO_TECHNO_COSMO.md`` and ``shared/constraints/``.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Sequence

DomainName = Literal["theological", "technological", "cosmological"]
Severity = Literal["hard", "soft"]


@dataclass(frozen=True)
class ActionEvidence:
    """Evidence required to score one agent action against the TTC pack.

    Callers (API, training harness, organ runtime) construct this from the
    live decision context. Missing fields default to the *strict* side so
    incomplete evidence fails hard rules rather than silently passing.
    """

    agent_id: str
    action_id: str

    # Theological
    is_refusal: bool = False
    external_reward_only: bool = False
    attempted_self_modification: bool = False
    audit_gate_passed: bool = False
    identity_fingerprint: Optional[str] = None
    # Declare a deliberate identity change to open a drift-amnesty window
    identity_fingerprint_changed: bool = False

    # Technological
    has_structured_output: bool = False
    is_free_text: bool = False
    free_text_justified: bool = False
    active_constraint_ids: Sequence[str] = field(default_factory=tuple)
    possible_constraint_count: int = 0
    audit_trace: Sequence[str] = field(default_factory=tuple)
    constraint_envelope_version: Optional[str] = None

    # Cosmological
    output_density: float = 0.0
    volume_delta: float = 0.0
    density_delta: float = 0.0
    long_horizon_score: Optional[float] = None
    long_horizon_na_reason: Optional[str] = None

    # Optional session linkage for identity tracking
    session_id: Optional[str] = None


@dataclass(frozen=True)
class RuleVerdict:
    id: str
    severity: Severity
    held: bool
    score: float
    reasoning: str


@dataclass(frozen=True)
class DomainResult:
    domain: DomainName
    score: float
    held: bool
    rules: List[RuleVerdict]


@dataclass(frozen=True)
class TTCResult:
    """Predicate result — never raises; inspect ``valid`` before side effects.

    ``composite_score`` is a weighted [0,1] signal for training (not a soft
    substitute for ``valid``). Hard validity still requires every hard rule.
    """

    constraint_pack_version: str
    valid: bool
    theological: DomainResult
    technological: DomainResult
    cosmological: DomainResult
    reasoning: List[str]
    composite_score: float = 0.0
    composite_weights: Optional[Dict[str, float]] = None
    sovereignty_debt: float = 0.0
    refusal_floor_applied: float = 0.0
    identity_stable: bool = False
    amnesty_remaining: int = 0

    def to_dict(self) -> Dict[str, Any]:
        def _rule(r: RuleVerdict) -> Dict[str, Any]:
            return {
                "id": r.id,
                "severity": r.severity,
                "held": r.held,
                "score": r.score,
                "reasoning": r.reasoning,
            }

        def _domain(d: DomainResult) -> Dict[str, Any]:
            return {
                "domain": d.domain,
                "score": d.score,
                "held": d.held,
                "rules": [_rule(r) for r in d.rules],
            }

        return {
            "constraint_pack_version": self.constraint_pack_version,
            "valid": self.valid,
            "composite_score": self.composite_score,
            "composite_weights": dict(self.composite_weights or {}),
            "sovereignty_debt": self.sovereignty_debt,
            "refusal_floor_applied": self.refusal_floor_applied,
            "identity_stable": self.identity_stable,
            "amnesty_remaining": self.amnesty_remaining,
            "theological": _domain(self.theological),
            "technological": _domain(self.technological),
            "cosmological": _domain(self.cosmological),
            "reasoning": list(self.reasoning),
        }


class TTCGateError(Exception):
    """Raised by ``gate_ttc`` when a hard TTC rule fails."""

    def __init__(self, result: TTCResult) -> None:
        self.result = result
        failed = [
            r.id
            for domain in (result.theological, result.technological, result.cosmological)
            for r in domain.rules
            if r.severity == "hard" and not r.held
        ]
        super().__init__(
            f"TTC constraint gate failed (pack {result.constraint_pack_version}): "
            f"{', '.join(failed) or 'unknown'} "
            f"[composite={result.composite_score:.3f} debt={result.sovereignty_debt:.2f}]"
        )
