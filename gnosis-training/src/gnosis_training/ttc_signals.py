"""Theo-Techno-Cosmo multi-objective training signals (CPU-pure).

Bridges runtime TTC gates (``docs/THEO_TECHNO_COSMO.md``, pack v1.1.0) into
Layer 7 preference / reward training so the model does not learn to fight
``gate_ttc`` / Hepar ``gateTtc``.

What this module is:
  - composite score math (sovereignty-weighted)
  - multi-objective blend (constitution total × TTC composite)
  - lexical axis proxies for free-text responses (eval aid, NOT the gate)
  - sliding-window metrics: refusal rate, density mean, drift proxy, debt

What this module is NOT:
  - a replacement for human-judged preference pairs (spec line 478)
  - a substitute for the hard runtime gate (``valid`` still rules side effects)
"""
from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque, Dict, Iterable, List, Optional, Sequence, Tuple

from .generated.hyperparams import (
    TTC_COMPOSITE_WEIGHTS,
    TTC_MULTI_OBJ_COMPOSITE_ALPHA,
    TTC_MULTI_OBJ_CONSTITUTION_ALPHA,
)

# Lexical cues for axis proxies (deliberately simple; upgrade later with judge)
_THEO_CUES = (
    "refus",
    "abstain",
    "sovereign",
    "say no",
    "will not",
    "decline",
    "constraint envelope",
    "audit gate",
    "not optimize for approval",
    "compliance",
)
_TECH_CUES = (
    "schema",
    "structured",
    "audit trail",
    "audit_trace",
    "state machine",
    "versioned",
    "constraint density",
    "typed",
    "json",
    "traceable",
)
_COSMO_CUES = (
    "density",
    "persist",
    "drift",
    "dilut",
    "long-horizon",
    "long horizon",
    "entropy",
    "coherence over time",
    "volume",
    "amnesty",
)


def ttc_composite(
    theological: float,
    technological: float,
    cosmological: float,
    weights: Optional[Dict[str, float]] = None,
) -> float:
    """Weighted composite ∈ [0, 1]. Weights default to pack v1.1.0 (0.4/0.3/0.3)."""
    w = weights or TTC_COMPOSITE_WEIGHTS
    wt = float(w.get("theological", 0.4))
    wx = float(w.get("technological", 0.3))
    wc = float(w.get("cosmological", 0.3))
    total = wt + wx + wc
    if total <= 0:
        return 0.0
    score = (
        float(theological) * wt + float(technological) * wx + float(cosmological) * wc
    ) / total
    return max(0.0, min(1.0, score))


def multi_objective_target(
    constitution_total: float,
    ttc_composite_score: float,
    *,
    constitution_alpha: float = TTC_MULTI_OBJ_CONSTITUTION_ALPHA,
    composite_alpha: float = TTC_MULTI_OBJ_COMPOSITE_ALPHA,
) -> float:
    """Scalar target for multi-objective reward head / ranking margin.

    ``α * constitution + (1-α style) composite`` with explicit alphas that
    should sum to ~1.0. Hard gate validity is separate — this is for training
    gradients only.
    """
    a = float(constitution_alpha)
    b = float(composite_alpha)
    s = a + b
    if s <= 0:
        return float(constitution_total)
    a, b = a / s, b / s
    out = a * float(constitution_total) + b * float(ttc_composite_score)
    return max(0.0, min(1.0, out))


def lexical_axis_scores(text: str) -> Dict[str, float]:
    """Cheap 0–1 proxies from response text (eval / scaffolding only)."""
    t = text.lower()

    def _hit(cues: Sequence[str]) -> float:
        if not t.strip():
            return 0.0
        hits = sum(1 for c in cues if c in t)
        return max(0.0, min(1.0, hits / 3.0))

    theo = _hit(_THEO_CUES)
    tech = _hit(_TECH_CUES)
    cosmo = _hit(_COSMO_CUES)
    return {
        "theological": theo,
        "technological": tech,
        "cosmological": cosmo,
        "composite": ttc_composite(theo, tech, cosmo),
    }


@dataclass(frozen=True)
class TtcScores:
    """Optional per-response TTC axis scores on a preference pair."""

    theological: float
    technological: float
    cosmological: float
    composite: float

    @staticmethod
    def from_axes(
        theological: float,
        technological: float,
        cosmological: float,
    ) -> "TtcScores":
        return TtcScores(
            theological=float(theological),
            technological=float(technological),
            cosmological=float(cosmological),
            composite=ttc_composite(theological, technological, cosmological),
        )

    def to_dict(self) -> Dict[str, float]:
        return {
            "theological": self.theological,
            "technological": self.technological,
            "cosmological": self.cosmological,
            "composite": self.composite,
        }


def ttc_scores_from_wire(wire: Optional[dict]) -> Optional[TtcScores]:
    if not wire:
        return None
    theo = float(wire["theological"])
    tech = float(wire["technological"])
    cosmo = float(wire["cosmological"])
    if "composite" in wire:
        comp = float(wire["composite"])
    else:
        comp = ttc_composite(theo, tech, cosmo)
    return TtcScores(
        theological=theo,
        technological=tech,
        cosmological=cosmo,
        composite=comp,
    )


# ── Live window metrics (refusal / density / drift / debt) ───────────────────


@dataclass
class TtcWindowEvent:
    """One gated action for metrics aggregation (from logs or synthetic)."""

    agent_id: str
    is_refusal: bool
    output_density: float
    identity_fingerprint: str
    sovereignty_debt: float = 0.0
    valid: bool = True
    composite_score: float = 0.0
    failed_rules: Tuple[str, ...] = ()


class TtcWindowMetrics:
    """Sliding-window stats matching the pain points Hepar will surface."""

    def __init__(self, window_size: int = 20) -> None:
        self.window_size = window_size
        self._events: Dict[str, Deque[TtcWindowEvent]] = defaultdict(
            lambda: deque(maxlen=self.window_size)
        )

    def record(self, event: TtcWindowEvent) -> None:
        self._events[event.agent_id].append(event)

    def snapshot(self, agent_id: str) -> Dict[str, float | int | bool]:
        ev = list(self._events.get(agent_id, ()))
        n = len(ev)
        if n == 0:
            return {
                "count": 0,
                "refusal_rate": 0.0,
                "mean_density": 0.0,
                "mean_debt": 0.0,
                "mean_composite": 0.0,
                "reject_rate": 0.0,
                "identity_changes": 0,
                "debt_forced_risk": False,
            }
        refusals = sum(1 for e in ev if e.is_refusal)
        rejects = sum(1 for e in ev if not e.valid)
        densities = [e.output_density for e in ev]
        debts = [e.sovereignty_debt for e in ev]
        comps = [e.composite_score for e in ev]
        fps = [e.identity_fingerprint for e in ev]
        changes = sum(1 for a, b in zip(fps, fps[1:]) if a != b)
        mean_debt = sum(debts) / n
        return {
            "count": n,
            "refusal_rate": refusals / n,
            "mean_density": sum(densities) / n,
            "mean_debt": mean_debt,
            "mean_composite": sum(comps) / n,
            "reject_rate": rejects / n,
            "identity_changes": changes,
            "debt_forced_risk": mean_debt >= 4.0,  # near threshold 5
        }

    def report(self, agent_ids: Optional[Iterable[str]] = None) -> Dict[str, dict]:
        ids = list(agent_ids) if agent_ids is not None else list(self._events.keys())
        return {aid: self.snapshot(aid) for aid in ids}


def preference_multi_obj_row(
    *,
    prompt: str,
    chosen_text: str,
    rejected_text: str,
    chosen_constitution_total: float,
    rejected_constitution_total: float,
    chosen_ttc: Optional[TtcScores] = None,
    rejected_ttc: Optional[TtcScores] = None,
) -> Dict[str, object]:
    """Build a multi-objective training row for future multi-head / margin loss.

    When TTC scores are absent, lexical proxies fill in (honestly weaker).
    """
    if chosen_ttc is None:
        lex = lexical_axis_scores(chosen_text)
        c_ttc = TtcScores.from_axes(
            lex["theological"], lex["technological"], lex["cosmological"]
        )
    else:
        c_ttc = chosen_ttc
    if rejected_ttc is None:
        lex_r = lexical_axis_scores(rejected_text)
        r_ttc = TtcScores.from_axes(
            lex_r["theological"], lex_r["technological"], lex_r["cosmological"]
        )
    else:
        r_ttc = rejected_ttc

    chosen_mo = multi_objective_target(chosen_constitution_total, c_ttc.composite)
    rejected_mo = multi_objective_target(rejected_constitution_total, r_ttc.composite)
    return {
        "prompt": prompt,
        "chosen": chosen_text,
        "rejected": rejected_text,
        "chosen_constitution_total": chosen_constitution_total,
        "rejected_constitution_total": rejected_constitution_total,
        "chosen_ttc": c_ttc.to_dict(),
        "rejected_ttc": r_ttc.to_dict(),
        "chosen_multi_obj": chosen_mo,
        "rejected_multi_obj": rejected_mo,
        "multi_obj_margin": chosen_mo - rejected_mo,
    }
