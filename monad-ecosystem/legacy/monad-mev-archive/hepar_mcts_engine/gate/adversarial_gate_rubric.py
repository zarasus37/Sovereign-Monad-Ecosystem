# hepar_mcts_engine/gate/adversarial_gate_rubric.py

from typing import List, Dict, Any


class AdversarialGateRubric:
    """
    5-criterion weighted scoring system for kill chain candidates.
    Minimum passing score: 0.75
    Higher than LOGOC's 0.72 — feeds legal-grade attestation.
    """

    CRITERIA = {
        "multi_agent_simultaneous_coverage": 0.30,
        "kill_chain_traceability":           0.25,
        "stage_b_invariant_alignment":       0.20,
        "execution_confidence_score":        0.15,
        "cross_agent_convergence_specificity": 0.10
    }

    PASSING_THRESHOLD = 0.75

    def score(
        self,
        chain: Dict[str, Any],
        agent_results: List[Dict[str, Any]],
        stage_b_refs: List[str] = None
    ) -> Dict[str, Any]:

        if stage_b_refs is None:
            stage_b_refs = []

        scores = {}

        # CRITERION 1 — Multi-Agent Simultaneous Coverage (0.30)
        # Did all 5 agents run concurrently?
        # Score 1.0 if all 5 converging agents present
        # Score 0.6 if 4/5, Score 0.2 if 3/5, Score 0.0 if < 3
        converging = set(chain.get("converging_agents", []))
        all_five = {
            "HeparPrivilegeAgent",
            "HeparArithmeticAgent",
            "HeparReentrancyAgent",
            "HeparEconomicAgent",
            "HeparStateAgent"
        }
        coverage_ratio = len(converging) / 5.0
        if len(converging) == 5:
            scores["multi_agent_simultaneous_coverage"] = 1.0
        elif len(converging) == 4:
            scores["multi_agent_simultaneous_coverage"] = 0.6
        elif len(converging) == 3:
            scores["multi_agent_simultaneous_coverage"] = 0.2
        else:
            scores["multi_agent_simultaneous_coverage"] = 0.0

        # CRITERION 2 — Kill Chain Traceability (0.25)
        # Is every step fully mapped with required fields?
        steps = chain.get("chain_steps", [])
        required_fields = {
            "agent", "action", "contract_state_hash",
            "execution_context", "estimated_value_at_risk"
        }
        if not steps:
            scores["kill_chain_traceability"] = 0.0
        else:
            complete_steps = sum(
                1 for s in steps
                if required_fields.issubset(s.keys())
                and s.get("contract_state_hash")
                and s.get("action")
            )
            scores["kill_chain_traceability"] = (
                complete_steps / len(steps)
            )

        # CRITERION 3 — Stage B Invariant Alignment (0.20)
        # Does the chain reference a specific Stage B counterexample?
        # Score 1.0 if chain entry references proven counterexample
        # Score 0.5 if any step has a counterexample reference
        # Score 0.0 if no Stage B alignment
        chain_cex_refs = [
            s.get("stage_b_counterexample_ref")
            for s in steps
            if s.get("stage_b_counterexample_ref")
        ]
        agent_cex_refs = [
            r.get("counterexample_ref")
            for r in agent_results
            if r.get("counterexample_ref")
        ]
        all_cex_refs = chain_cex_refs + agent_cex_refs

        if all_cex_refs and stage_b_refs:
            matched = any(
                ref in stage_b_refs for ref in all_cex_refs
            )
            scores["stage_b_invariant_alignment"] = (
                1.0 if matched else 0.5
            )
        elif all_cex_refs:
            scores["stage_b_invariant_alignment"] = 0.5
        else:
            scores["stage_b_invariant_alignment"] = 0.0

        # CRITERION 4 — Execution Confidence Score (0.15)
        # Mean MCTS confidence across all agents at convergence
        confidences = [
            float(r.get("confidence", 0.0))
            for r in agent_results
        ]
        scores["execution_confidence_score"] = (
            sum(confidences) / len(confidences)
            if confidences else 0.0
        )

        # CRITERION 5 — Cross-Agent Convergence Specificity (0.10)
        # Is convergence tied to specific contract state
        # (not just general vulnerability class)?
        convergence_hash = chain.get("convergence_state_hash", "")
        converging_steps = [
            s for s in steps
            if s.get("contract_state_hash") == convergence_hash
        ]
        if len(converging_steps) >= 2 and convergence_hash:
            # Check if execution_context has specific details
            has_specific = any(
                s.get("execution_context") and
                len(s.get("execution_context", {})) > 0
                for s in converging_steps
            )
            scores["cross_agent_convergence_specificity"] = (
                1.0 if has_specific else 0.5
            )
        elif convergence_hash:
            scores["cross_agent_convergence_specificity"] = 0.5
        else:
            scores["cross_agent_convergence_specificity"] = 0.0

        # Weighted final score
        gate_score = sum(
            scores[criterion] * weight
            for criterion, weight in self.CRITERIA.items()
        )

        chain["gate_score"] = round(gate_score, 4)
        chain["rubric_breakdown"] = {
            k: round(v, 4) for k, v in scores.items()
        }
        chain["attestation_eligible"] = (
            gate_score >= self.PASSING_THRESHOLD
        )

        return chain