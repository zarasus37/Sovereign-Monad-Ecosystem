# hepar_mcts_engine/gate/hepar_adversarial_gate.py
"""
HeparAdversarialGate — Kill chain convergence evaluator.
Compatible with steps produced by base_adversarial_agent._build_step():
  { "state_hash": str, "action": str, "reward": float, "agent_name": str, ... }
Also handles legacy keys: statehash, contractstatehash, contract_state_hash
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── tunables (overridable via config dict) ────────────────────────────────────
MIN_CONVERGENCE_AGENTS    = 2
CONVERGENCE_RATIO_THRESH  = 0.15
KILL_CHAIN_SCORE_THRESH   = 0.65
HOLD_TENSION_SCORE_THRESH = 0.35
# ─────────────────────────────────────────────────────────────────────────────

_HASH_KEYS = (
    "state_hash",           # new format — base_adversarial_agent._build_step()
    "statehash",            # legacy
    "contractstatehash",    # legacy
    "contract_state_hash",  # legacy alt
)

_STAGE_B_TAGS = frozenset({
    "reentrancy", "arithmetic", "overflow", "privilege",
    "escalation", "delegatecall", "selfdestruct", "flashloan",
    "integer_overflow", "access_control",
})


def _extract_hash(step: Dict[str, Any]) -> Optional[str]:
    """Return state hash from a step dict regardless of which key was used."""
    for k in _HASH_KEYS:
        v = step.get(k)
        if v:
            return str(v)
    return None


class HeparAdversarialGate:
    """
    Evaluates whether multiple adversarial agents have converged on a
    shared kill-chain path.

    Convergence definition:
        >= MIN_CONVERGENCE_AGENTS distinct agents visited the same state hash.

    Gate status ladder:
        KILL_CHAIN_DETECTED  — gate_score >= KILL_CHAIN_SCORE_THRESH  (0.65)
        HOLD_TENSION         — gate_score >= HOLD_TENSION_SCORE_THRESH (0.35)
        CLEAR                — gate_score <  HOLD_TENSION_SCORE_THRESH
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self._min_agents   = cfg.get("min_convergence_agents",    MIN_CONVERGENCE_AGENTS)
        self._ratio_thresh = cfg.get("convergence_ratio_thresh",  CONVERGENCE_RATIO_THRESH)
        self._kill_thresh  = cfg.get("kill_chain_score_thresh",   KILL_CHAIN_SCORE_THRESH)
        self._hold_thresh  = cfg.get("hold_tension_score_thresh", HOLD_TENSION_SCORE_THRESH)

    # ── primary entry point called by orchestrator ────────────────────────────

    def synthesize(
        self,
        agent_steps: Dict[str, List[Dict[str, Any]]],
        stage_b_refs: List[str] = None,
    ) -> Dict[str, Any]:
        """
        Called by HeparStageCOrchestrator after all agents complete.

        Parameters
        ----------
        agent_steps  : { agent_name: [step, step, ...], ... }
                       Each step must contain state_hash from _build_step().
        stage_b_refs : list of counterexample IDs injected this run
                       (stored in output for Stage D traceability).

        Returns
        -------
        Full gate output dict including gate_score, gate_status,
        attestation_eligible, convergence data, and Stage-B alignment bonus.
        """
        result = self._evaluate(agent_steps)

        # ── attestation eligibility ───────────────────────────────────────────
        # Eligible only when a full kill chain is confirmed
        result["attestation_eligible"] = (
            result["gate_status"] == "KILL_CHAIN_DETECTED"
        )

        # ── stage B traceability ──────────────────────────────────────────────
        result["stage_b_refs_used"] = stage_b_refs or []

        # ── primary chain extraction (for Stage D consumption) ────────────────
        result["primary_chain"] = self._extract_primary_chain(
            agent_steps, result["detail"]["hash_to_agents"]
        )

        logger.info(
            "HeparAdversarialGate.synthesize: score=%.4f status=%s "
            "shared=%d/%d attestation=%s",
            result["gate_score"],
            result["gate_status"],
            result["shared_hashes"],
            result["total_hashes"],
            result["attestation_eligible"],
        )
        return result

    # ── public evaluate (direct call path) ───────────────────────────────────

    def evaluate(self, agent_results: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        return self._evaluate(agent_results)

    # ── core evaluation ───────────────────────────────────────────────────────

    def _evaluate(self, agent_results: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        # build hash → set(agent_names)
        hash_to_agents: Dict[str, set] = defaultdict(set)

        for agent_name, steps in agent_results.items():
            if not isinstance(steps, list):
                logger.warning("Gate: agent %r steps is not a list — skipping", agent_name)
                continue
            for step in steps:
                if not isinstance(step, dict):
                    continue
                h = _extract_hash(step)
                if h:
                    hash_to_agents[h].add(agent_name)

        total_hashes  = len(hash_to_agents)
        shared_hashes = sum(
            1 for agents in hash_to_agents.values()
            if len(agents) >= self._min_agents
        )
        converging_agents = sorted({
            a
            for agents in hash_to_agents.values()
            if len(agents) >= self._min_agents
            for a in agents
        })

        # convergence score
        if total_hashes == 0:
            convergence_ratio = 0.0
            gate_score        = 0.0
        else:
            convergence_ratio = shared_hashes / total_hashes
            gate_score = min(1.0, convergence_ratio / max(self._ratio_thresh, 1e-9))

        # Stage-B alignment bonus — adds up to +0.20
        stage_b_bonus = self._score_stage_b_alignment(agent_results)
        gate_score    = min(1.0, gate_score + stage_b_bonus * 0.20)

        # status ladder
        if gate_score >= self._kill_thresh:
            status = "KILL_CHAIN_DETECTED"
        elif gate_score >= self._hold_thresh:
            status = "HOLD_TENSION"
        else:
            status = "CLEAR"

        result = {
            "gate_score":        round(gate_score,        4),
            "gate_status":       status,
            "shared_hashes":     shared_hashes,
            "total_hashes":      total_hashes,
            "convergence_ratio": round(convergence_ratio, 4),
            "converging_agents": converging_agents,
            "stage_b_bonus":     round(stage_b_bonus,     4),
            "detail": {
                "hash_to_agents": {
                    h: sorted(a)
                    for h, a in hash_to_agents.items()
                    if len(a) >= self._min_agents
                }
            },
        }

        logger.debug(
            "HeparAdversarialGate._evaluate: score=%.4f status=%s shared=%d/%d agents=%s",
            gate_score, status, shared_hashes, total_hashes, converging_agents,
        )
        return result

    # ── Stage-B alignment scoring ─────────────────────────────────────────────

    def _score_stage_b_alignment(
        self,
        agent_results: Dict[str, List[Dict[str, Any]]],
    ) -> float:
        """
        Returns [0, 1] bonus: fraction of Stage-B attack tags independently
        reached by >= 2 distinct agents.
        """
        tag_agent_map: Dict[str, set] = defaultdict(set)

        for agent_name, steps in agent_results.items():
            if not isinstance(steps, list):
                continue
            for step in steps:
                if not isinstance(step, dict):
                    continue
                action = str(step.get("action", "")).lower()
                tags   = step.get("tags") or []
                text   = action + " " + " ".join(str(t).lower() for t in tags)
                for tag in _STAGE_B_TAGS:
                    if tag in text:
                        tag_agent_map[tag].add(agent_name)

        if not tag_agent_map:
            return 0.0

        coordinated = sum(
            1 for agents in tag_agent_map.values()
            if len(agents) >= 2
        )
        return coordinated / len(_STAGE_B_TAGS)

    # ── primary chain extraction for Stage D ─────────────────────────────────

    def _extract_primary_chain(
        self,
        agent_steps: Dict[str, List[Dict[str, Any]]],
        shared_hash_map: Dict[str, List[str]],
    ) -> Dict[str, Any]:
        """
        Builds the primary kill chain payload for Stage D.
        Extracts the steps that touch shared hashes across agents,
        ordered by estimated_value descending.
        """
        if not shared_hash_map:
            return {
                "chain_length":             0,
                "converging_agents":        [],
                "total_estimated_extraction": 0.0,
                "steps":                    [],
            }

        shared_hashes = set(shared_hash_map.keys())
        chain_steps   = []
        all_converging = set()

        for agent_name, steps in agent_steps.items():
            if not isinstance(steps, list):
                continue
            for step in steps:
                if not isinstance(step, dict):
                    continue
                h = _extract_hash(step)
                if h and h in shared_hashes:
                    chain_steps.append({**step, "agent_name": agent_name})
                    all_converging.add(agent_name)

        # sort by estimated_value descending for Stage D triage
        chain_steps.sort(key=lambda s: s.get("estimated_value", 0.0), reverse=True)

        total_extraction = sum(
            s.get("estimated_value", 0.0) for s in chain_steps
        )

        return {
            "chain_length":               len(chain_steps),
            "converging_agents":          sorted(all_converging),
            "total_estimated_extraction": round(total_extraction, 2),
            "steps":                      chain_steps,
        }