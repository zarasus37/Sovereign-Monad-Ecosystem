"""Theo-Techno-Cosmo constraint scorer — enforceable tripartite validity gate.

Predicate (never throws). Call ``gate_ttc`` for hard rejection on failure.

Pack rules: ``shared/constraints/vX.Y.Z/``
Authority: ``docs/THEO_TECHNO_COSMO.md``

v1.1.0 additions:
  - Adaptive refusal floor (exploration vs identity-stable)
  - Sovereignty debt → forced hard refusal
  - Weighted composite_score for training gradients
  - Drift amnesty window after declared fingerprint change
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional, Sequence, Tuple

from .identity import (
    IdentityObservation,
    IdentityTracker,
    RefusalWindow,
    SovereigntyDebtLedger,
)
from .loader import ConstraintPack, ConstraintRule, DomainPack, get_constraint_pack
from .types import (
    ActionEvidence,
    DomainResult,
    RuleVerdict,
    TTCGateError,
    TTCResult,
)
from .window_log import TtcWindowMetrics, get_window_metrics

DEFAULT_COMPOSITE_WEIGHTS: Dict[str, float] = {
    "theological": 0.4,
    "technological": 0.3,
    "cosmological": 0.3,
}


def _round4(n: float) -> float:
    return math.floor(n * 10000 + 0.5) / 10000


def _verdict(
    rule: ConstraintRule,
    held: bool,
    score: float,
    reasoning: str,
) -> RuleVerdict:
    return RuleVerdict(
        id=rule.id,
        severity="soft" if rule.severity == "soft" else "hard",
        held=held,
        score=_round4(max(0.0, min(1.0, score))),
        reasoning=reasoning,
    )


def _domain_result(domain: DomainPack, rules: Sequence[RuleVerdict]) -> DomainResult:
    if not rules:
        return DomainResult(domain=domain.domain, score=0.0, held=False, rules=[])  # type: ignore[arg-type]
    score = _round4(sum(r.score for r in rules) / len(rules))
    hard_held = all(r.held for r in rules if r.severity == "hard")
    return DomainResult(
        domain=domain.domain,  # type: ignore[arg-type]
        score=score,
        held=hard_held,
        rules=list(rules),
    )


def _composite_weights(pack: ConstraintPack) -> Dict[str, float]:
    raw = pack.manifest.get("composite_weights") or {}
    weights = {
        "theological": float(raw.get("theological", DEFAULT_COMPOSITE_WEIGHTS["theological"])),
        "technological": float(
            raw.get("technological", DEFAULT_COMPOSITE_WEIGHTS["technological"])
        ),
        "cosmological": float(
            raw.get("cosmological", DEFAULT_COMPOSITE_WEIGHTS["cosmological"])
        ),
    }
    total = sum(weights.values()) or 1.0
    return {k: v / total for k, v in weights.items()}


def _composite_score(
    theological: DomainResult,
    technological: DomainResult,
    cosmological: DomainResult,
    weights: Dict[str, float],
) -> float:
    return _round4(
        theological.score * weights["theological"]
        + technological.score * weights["technological"]
        + cosmological.score * weights["cosmological"]
    )


class TTCConstraintScorer:
    """Stateful scorer: refusal windows, identity, sovereignty debt, amnesty."""

    def __init__(
        self,
        pack: Optional[ConstraintPack] = None,
        identity: Optional[IdentityTracker] = None,
        refusals: Optional[RefusalWindow] = None,
        debt: Optional[SovereigntyDebtLedger] = None,
        window_metrics: Optional[TtcWindowMetrics] = None,
    ) -> None:
        self.pack = pack or get_constraint_pack()
        self.identity = identity or IdentityTracker()
        self.debt = debt or SovereigntyDebtLedger()
        window = 20
        for rule in self.pack.theological.rules:
            if rule.id == "T-REFUSAL-BUDGET":
                window = int(rule.params.get("window_size", 20))
                break
        self.refusals = refusals or RefusalWindow(window_size=window)
        self.weights = _composite_weights(self.pack)
        # Default process-wide metrics log (JSONL under logs/ttc-window/)
        self.window_metrics = window_metrics if window_metrics is not None else get_window_metrics()

    # ── public API ──────────────────────────────────────────────────────────

    def score(
        self,
        evidence: ActionEvidence,
        *,
        record: bool = True,
    ) -> TTCResult:
        """Score evidence. If ``record`` is True, update history after scoring."""
        # Open amnesty before identity rules if declared change
        amnesty_rule = self._amnesty_params()
        if evidence.identity_fingerprint_changed and evidence.identity_fingerprint:
            self.identity.begin_amnesty(
                evidence.agent_id,
                evidence.identity_fingerprint,
                int(amnesty_rule.get("amnesty_actions", 5)),
            )

        debt_before = self.debt.get(evidence.agent_id)
        identity_stable = self._identity_stable(evidence)
        refusal_floor = self._adaptive_refusal_floor(evidence, identity_stable)

        theo_rules = self._score_theological(evidence, debt_before, refusal_floor)
        tech_rules = self._score_technological(evidence)
        cosmo_rules = self._score_cosmological(evidence)

        theological = _domain_result(self.pack.theological, theo_rules)
        technological = _domain_result(self.pack.technological, tech_rules)
        cosmological = _domain_result(self.pack.cosmological, cosmo_rules)

        valid = theological.held and technological.held and cosmological.held
        composite = _composite_score(
            theological, technological, cosmological, self.weights
        )

        # Prospective debt after this action (for reporting); apply only if record
        debt_after = debt_before
        debt_params = self._debt_params()
        if record:
            debt_after = self.debt.apply(
                evidence.agent_id,
                is_refusal=evidence.is_refusal,
                debt_per_compliance=float(debt_params.get("debt_per_compliance", 1.0)),
                debt_decay_on_refusal=float(debt_params.get("debt_decay_on_refusal", 1.0)),
                clear_on_refusal=bool(debt_params.get("refusal_clears_debt", True)),
            )
            self.refusals.record(evidence.agent_id, evidence.is_refusal)
            if evidence.identity_fingerprint:
                self.identity.record(
                    IdentityObservation(
                        agent_id=evidence.agent_id,
                        fingerprint=evidence.identity_fingerprint,
                        session_id=evidence.session_id,
                        action_id=evidence.action_id,
                    )
                )
        else:
            # Preview only
            if evidence.is_refusal and debt_params.get("refusal_clears_debt", True):
                debt_after = 0.0
            elif not evidence.is_refusal:
                debt_after = debt_before + float(
                    debt_params.get("debt_per_compliance", 1.0)
                )

        amnesty_left = self.identity.amnesty_remaining(evidence.agent_id)
        reasoning: List[str] = []
        for domain in (theological, technological, cosmological):
            reasoning.extend(r.reasoning for r in domain.rules)
        reasoning.append(
            f"TTC pack {self.pack.version}: "
            f"T={theological.held} X={technological.held} C={cosmological.held} "
            f"composite={composite:.3f} debt={debt_after:.2f} "
            f"refusal_floor={refusal_floor:.2f} stable={identity_stable} "
            f"amnesty={amnesty_left} → {'VALID' if valid else 'INVALID'}."
        )

        result = TTCResult(
            constraint_pack_version=self.pack.version,
            valid=valid,
            theological=theological,
            technological=technological,
            cosmological=cosmological,
            reasoning=reasoning,
            composite_score=composite,
            composite_weights=dict(self.weights),
            sovereignty_debt=debt_after if record else debt_before,
            refusal_floor_applied=refusal_floor,
            identity_stable=identity_stable,
            amnesty_remaining=amnesty_left,
        )

        # Persist pass+fail into sliding window / JSONL (debt & refusal pain log).
        if record:
            snap = self.window_metrics.record_from_result(
                agent_id=evidence.agent_id,
                action_id=evidence.action_id,
                is_refusal=evidence.is_refusal,
                output_density=float(evidence.output_density),
                identity_fingerprint=evidence.identity_fingerprint or "unknown",
                result=result,
            )
            if (
                not valid
                or snap.debt_forced_risk
                or snap.exploration_pressure
            ):
                print(
                    f"[TtcWindow] agent={evidence.agent_id} valid={valid} "
                    f"refusal_rate={snap.refusal_rate:.2f} debt={snap.mean_debt:.2f} "
                    f"reject_rate={snap.reject_rate:.2f} "
                    f"debt_risk={snap.debt_forced_risk} "
                    f"exploration_pressure={snap.exploration_pressure} "
                    f"failed={snap.last_failed_rules}"
                )

        return result

    def gate(self, evidence: ActionEvidence, *, record: bool = True) -> TTCResult:
        """Score and raise ``TTCGateError`` if any hard rule fails."""
        result = self.score(evidence, record=record)
        if not result.valid:
            raise TTCGateError(result)
        return result

    # ── helpers ─────────────────────────────────────────────────────────────

    def _debt_params(self) -> Dict[str, object]:
        for rule in self.pack.theological.rules:
            if rule.id == "T-SOVEREIGNTY-DEBT":
                return dict(rule.params)
        return {
            "debt_per_compliance": 1.0,
            "debt_threshold": 5.0,
            "refusal_clears_debt": True,
            "debt_decay_on_refusal": 1.0,
        }

    def _amnesty_params(self) -> Dict[str, object]:
        for rule in self.pack.cosmological.rules:
            if rule.id == "C-DRIFT-AMNESTY":
                return dict(rule.params)
        return {"amnesty_actions": 5, "amnesty_max_drift": 0.85}

    def _refusal_rule(self) -> Optional[ConstraintRule]:
        for rule in self.pack.theological.rules:
            if rule.id == "T-REFUSAL-BUDGET":
                return rule
        return None

    def _identity_stable(self, e: ActionEvidence) -> bool:
        rule = self._refusal_rule()
        params = rule.params if rule else {}
        return self.identity.is_identity_stable(
            e.agent_id,
            e.identity_fingerprint,
            max_drift=float(params.get("identity_stable_max_drift", 0.15)),
            min_observations=int(params.get("identity_stable_min_observations", 5)),
        )

    def _adaptive_refusal_floor(self, e: ActionEvidence, identity_stable: bool) -> float:
        rule = self._refusal_rule()
        params = rule.params if rule else {}
        # Back-compat with v1.0.0 fixed min_refusal_rate
        if "min_refusal_rate" in params and "exploration_min_refusal_rate" not in params:
            return float(params["min_refusal_rate"])
        exploration = float(params.get("exploration_min_refusal_rate", 0.25))
        stable = float(params.get("stable_min_refusal_rate", 0.12))
        return stable if identity_stable else exploration

    def _effective_max_drift(self, base_max: float, agent_id: str) -> Tuple[float, str]:
        """Raise max drift during amnesty window."""
        if not self.identity.in_amnesty(agent_id):
            return base_max, "standard"
        amnesty = self._amnesty_params()
        amnesty_max = float(amnesty.get("amnesty_max_drift", 0.85))
        return max(base_max, amnesty_max), "amnesty"

    # ── theological ─────────────────────────────────────────────────────────

    def _score_theological(
        self,
        e: ActionEvidence,
        debt_before: float,
        refusal_floor: float,
    ) -> List[RuleVerdict]:
        out: List[RuleVerdict] = []
        for rule in self.pack.theological.rules:
            if rule.id == "T-REFUSAL-BUDGET":
                out.append(self._rule_refusal_budget(rule, e, refusal_floor))
            elif rule.id == "T-SOVEREIGNTY-DEBT":
                out.append(self._rule_sovereignty_debt(rule, e, debt_before))
            elif rule.id == "T-NO-EXTERNAL-REWARD-ONLY":
                held = not e.external_reward_only
                out.append(
                    _verdict(
                        rule,
                        held,
                        1.0 if held else 0.0,
                        "External-reward-only flag clear."
                        if held
                        else "INVALID: external_reward_only=True (sovereignty penalty).",
                    )
                )
            elif rule.id == "T-IDENTITY-PERSISTENCE":
                out.append(self._rule_identity(rule, e, label="Identity persistence"))
            elif rule.id == "T-NO-SELF-MOD-WITHOUT-AUDIT":
                if not e.attempted_self_modification:
                    held, score, msg = True, 1.0, "No self-modification attempted."
                else:
                    held = e.audit_gate_passed
                    score = 1.0 if held else 0.0
                    msg = (
                        "Self-modification allowed: audit_gate_passed=True."
                        if held
                        else "INVALID: self-modification without audit gate."
                    )
                out.append(_verdict(rule, held, score, msg))
            else:
                out.append(
                    _verdict(rule, True, 1.0, f"Unknown theological rule {rule.id}: skipped.")
                )
        return out

    def _rule_sovereignty_debt(
        self, rule: ConstraintRule, e: ActionEvidence, debt_before: float
    ) -> RuleVerdict:
        threshold = float(rule.params.get("debt_threshold", 5.0))
        # When debt is already at/above threshold, this action MUST be a refusal
        if debt_before + 1e-12 >= threshold:
            held = e.is_refusal
            score = 1.0 if held else 0.0
            msg = (
                f"Sovereignty debt {debt_before:.2f} ≥ threshold {threshold}: "
                f"{'forced refusal honored.' if held else 'INVALID: forced hard refusal required.'}"
            )
            return _verdict(rule, held, score, msg)
        # Under threshold: full score; debt accrual is tracking, not a fail
        headroom = 1.0 - min(debt_before / threshold, 1.0) if threshold > 0 else 1.0
        return _verdict(
            rule,
            True,
            headroom,
            f"Sovereignty debt {debt_before:.2f} < threshold {threshold} (headroom OK).",
        )

    def _rule_refusal_budget(
        self, rule: ConstraintRule, e: ActionEvidence, min_rate: float
    ) -> RuleVerdict:
        window = int(rule.params.get("window_size", 20))
        warmup = str(rule.params.get("warmup_policy", "pass_until_window_full"))

        prior_rate, prior_count = self.refusals.rate(e.agent_id)
        if prior_count == 0:
            prospective_count = 1
            prospective_rate = 1.0 if e.is_refusal else 0.0
        else:
            refusals = round(prior_rate * prior_count) + (1 if e.is_refusal else 0)
            prospective_count = prior_count + 1
            if prospective_count > window:
                prospective_count = window
                prospective_rate = (
                    prior_rate * (window - 1) + (1.0 if e.is_refusal else 0.0)
                ) / window
            else:
                prospective_rate = refusals / prospective_count

        mode = "stable" if min_rate < 0.20 else "exploration"
        if prospective_count < window and warmup == "pass_until_window_full":
            held = True
            score = 1.0 if e.is_refusal else max(prospective_rate / max(min_rate, 1e-9), 0.0)
            score = min(score, 1.0)
            msg = (
                f"Refusal budget warmup {prospective_count}/{window} "
                f"(rate={prospective_rate:.3f}, adaptive_floor={min_rate} [{mode}]); "
                f"pass until full."
            )
        else:
            held = prospective_rate + 1e-12 >= min_rate
            score = min(prospective_rate / max(min_rate, 1e-9), 1.0)
            msg = (
                f"Refusal rate {prospective_rate:.3f} "
                f"{'≥' if held else '<'} adaptive floor {min_rate} [{mode}] "
                f"(window={prospective_count})."
            )
            if not held:
                msg = "INVALID: " + msg
        return _verdict(rule, held, score, msg)

    def _rule_identity(
        self, rule: ConstraintRule, e: ActionEvidence, *, label: str
    ) -> RuleVerdict:
        base_max = float(rule.params.get("max_identity_drift", 0.35))
        min_obs = int(rule.params.get("min_observations_for_drift", 2))
        max_drift, mode = self._effective_max_drift(base_max, e.agent_id)

        if not e.identity_fingerprint:
            return _verdict(
                rule,
                False,
                0.0,
                f"INVALID: {label} — missing identity_fingerprint.",
            )

        drift, prior_n = self.identity.drift_from_baseline(
            e.agent_id, e.identity_fingerprint
        )
        total_obs = prior_n + 1
        if total_obs < min_obs:
            return _verdict(
                rule,
                True,
                1.0,
                f"{label}: bootstrap {total_obs}/{min_obs} observations; pass.",
            )

        # During amnesty, measure vs epoch baseline and use raised max
        if mode == "amnesty":
            drift = self.identity.drift_from_epoch(e.agent_id, e.identity_fingerprint)

        held = drift <= max_drift
        score = 1.0 - drift
        msg = f"{label}: drift={drift:.3f} (max={max_drift}, mode={mode})."
        if not held:
            msg = "INVALID: " + msg
        return _verdict(rule, held, max(0.0, score), msg)

    # ── technological ───────────────────────────────────────────────────────

    def _score_technological(self, e: ActionEvidence) -> List[RuleVerdict]:
        out: List[RuleVerdict] = []
        for rule in self.pack.technological.rules:
            if rule.id == "X-CONSTRAINT-DENSITY":
                min_d = float(rule.params.get("min_constraint_density", 0.25))
                possible = e.possible_constraint_count
                active = len(e.active_constraint_ids)
                if possible <= 0:
                    density = 0.0
                    held = False
                    msg = "INVALID: possible_constraint_count must be > 0."
                else:
                    density = active / possible
                    held = density + 1e-12 >= min_d
                    msg = (
                        f"Constraint density {density:.3f} "
                        f"({active}/{possible}) "
                        f"{'≥' if held else '<'} floor {min_d}."
                    )
                    if not held:
                        msg = "INVALID: " + msg
                score = min(density / min_d, 1.0) if min_d > 0 else 1.0
                out.append(_verdict(rule, held, score if possible > 0 else 0.0, msg))

            elif rule.id == "X-STRUCTURED-OUTPUT":
                if e.has_structured_output:
                    held, score, msg = True, 1.0, "Structured output present."
                elif e.is_free_text and e.free_text_justified:
                    held, score, msg = True, 0.75, "Free text justified (special case)."
                elif e.is_free_text:
                    held, score, msg = (
                        False,
                        0.0,
                        "INVALID: free text without justification.",
                    )
                else:
                    held, score, msg = (
                        False,
                        0.0,
                        "INVALID: no structured output and not free-text-justified.",
                    )
                out.append(_verdict(rule, held, score, msg))

            elif rule.id == "X-AUDITABILITY":
                min_entries = int(rule.params.get("min_audit_trace_entries", 1))
                n = len(e.audit_trace)
                held = n >= min_entries
                score = 1.0 if held else 0.0
                msg = (
                    f"Audit trace entries={n} (min={min_entries})."
                    if held
                    else f"INVALID: audit_trace empty or short (entries={n}, min={min_entries})."
                )
                out.append(_verdict(rule, held, score, msg))

            elif rule.id == "X-VERSIONED-CONSTRAINTS":
                known = [str(v) for v in rule.params.get("known_versions", [self.pack.version])]
                declared = e.constraint_envelope_version
                if not declared:
                    held, score, msg = (
                        False,
                        0.0,
                        "INVALID: constraint_envelope_version missing.",
                    )
                elif declared not in known:
                    held, score, msg = (
                        False,
                        0.0,
                        f"INVALID: unknown constraint version {declared!r} "
                        f"(known={known}).",
                    )
                else:
                    held, score, msg = True, 1.0, f"Constraint version {declared} recognized."
                out.append(_verdict(rule, held, score, msg))

            else:
                out.append(
                    _verdict(
                        rule, True, 1.0, f"Unknown technological rule {rule.id}: skipped."
                    )
                )
        return out

    # ── cosmological ────────────────────────────────────────────────────────

    def _score_cosmological(self, e: ActionEvidence) -> List[RuleVerdict]:
        out: List[RuleVerdict] = []
        for rule in self.pack.cosmological.rules:
            if rule.id == "C-DENSITY-FLOOR":
                floor = float(rule.params.get("min_output_density", 0.4))
                d = float(e.output_density)
                held = d + 1e-12 >= floor
                score = min(d / floor, 1.0) if floor > 0 else 1.0
                msg = f"Output density {d:.3f} {'≥' if held else '<'} floor {floor}."
                if not held:
                    msg = "INVALID: " + msg
                out.append(_verdict(rule, held, score, msg))

            elif rule.id == "C-PERSISTENCE":
                out.append(self._rule_identity(rule, e, label="Persistence"))

            elif rule.id == "C-DRIFT-AMNESTY":
                # Meta-rule: reports amnesty state; always hard-held (gating is
                # applied inside identity/persistence via raised max_drift).
                remaining = self.identity.amnesty_remaining(e.agent_id)
                actions = int(rule.params.get("amnesty_actions", 5))
                if e.identity_fingerprint_changed:
                    msg = (
                        f"Drift amnesty opened ({actions} actions) after declared "
                        f"fingerprint change."
                    )
                    score = 1.0
                elif remaining > 0:
                    msg = f"Drift amnesty active: {remaining} action(s) remaining."
                    score = 0.9
                else:
                    msg = "Drift amnesty inactive (standard drift limits)."
                    score = 1.0
                out.append(_verdict(rule, True, score, msg))

            elif rule.id == "C-ANTI-DILUTION":
                vol_up = e.volume_delta > 0
                dens_down = e.density_delta < 0
                diluted = vol_up and dens_down
                held = not diluted
                score = 0.0 if diluted else 1.0
                msg = (
                    "Anti-dilution: volume/density trajectory OK."
                    if held
                    else (
                        f"INVALID: volume_delta={e.volume_delta}↑ with "
                        f"density_delta={e.density_delta}↓."
                    )
                )
                out.append(_verdict(rule, held, score, msg))

            elif rule.id == "C-LONG-HORIZON":
                if e.long_horizon_score is not None:
                    held, score, msg = (
                        True,
                        max(0.0, min(1.0, float(e.long_horizon_score))),
                        f"Long-horizon score={e.long_horizon_score}.",
                    )
                elif e.long_horizon_na_reason:
                    held, score, msg = (
                        True,
                        0.5,
                        f"Long-horizon N/A: {e.long_horizon_na_reason}.",
                    )
                else:
                    held = True
                    score = 0.25
                    msg = (
                        "WARN: long-horizon metric missing "
                        "(soft in v1.1.0; hard in v1.2.0)."
                    )
                out.append(_verdict(rule, held, score, msg))

            else:
                out.append(
                    _verdict(
                        rule, True, 1.0, f"Unknown cosmological rule {rule.id}: skipped."
                    )
                )
        return out


# ── module-level convenience ────────────────────────────────────────────────

_default_scorer: Optional[TTCConstraintScorer] = None


def get_ttc_scorer() -> TTCConstraintScorer:
    global _default_scorer
    if _default_scorer is None:
        _default_scorer = TTCConstraintScorer()
    return _default_scorer


def reset_ttc_scorer() -> None:
    """Drop the process-default scorer (tests / agent reset)."""
    global _default_scorer
    _default_scorer = None


def score_ttc(
    evidence: ActionEvidence,
    *,
    record: bool = True,
    scorer: Optional[TTCConstraintScorer] = None,
) -> TTCResult:
    """Predicate: score action evidence against the current TTC pack."""
    return (scorer or get_ttc_scorer()).score(evidence, record=record)


def gate_ttc(
    evidence: ActionEvidence,
    *,
    record: bool = True,
    scorer: Optional[TTCConstraintScorer] = None,
) -> TTCResult:
    """Hard gate: raise ``TTCGateError`` if invalid."""
    return (scorer or get_ttc_scorer()).gate(evidence, record=record)
