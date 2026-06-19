from typing import List, Dict, Any
from .kill_chain_detector import KillChainDetector
from .adversarial_gate_rubric import AdversarialGateRubric


class GateStatus:
    KILL_CHAIN_DETECTED = "KILL_CHAIN_DETECTED"
    HOLD_TENSION = "HOLD_TENSION"


class HeparAdversarialGate:
    PASSING_THRESHOLD = 0.75

    def __init__(self, threshold: float = 0.75):
        self.threshold = float(threshold)
        self.required_agents = {
            "HeparPrivilegeAgent",
            "HeparArithmeticAgent",
            "HeparReentrancyAgent",
            "HeparEconomicAgent",
            "HeparStateAgent"
        }
        self.chain_detector = KillChainDetector()
        self.rubric = AdversarialGateRubric()

    def synthesize(
        self,
        agent_findings: Dict[str, Any],
        stage_b_refs: List[str] = None
    ) -> Dict[str, Any]:
        if stage_b_refs is None:
            stage_b_refs = []

        print("[Hepar Adversarial Gate v3.0] Evaluating Cross-Agent Co-Inherence...")

        participating = set(agent_findings.keys())
        missing = self.required_agents - participating
        if missing:
            raise ValueError(f"Co-inherence failure: Missing agents: {sorted(list(missing))}")

        results_list = []
        for name, finding in agent_findings.items():
            if isinstance(finding, dict):
                results_list.append(finding)
            else:
                results_list.append({
                    "agent": name,
                    "confidence": getattr(finding, 'confidence', 0.0),
                    "finding": getattr(finding, 'finding', ''),
                    "total_paths_explored": getattr(finding, 'total_paths_explored', 0),
                    "counterexample_ref": getattr(finding, 'counterexample_ref', None),
                    "step_map": getattr(finding, 'step_map', [])
                })

        chains = self.chain_detector.scan(agent_findings)

        scored_chains = [
            self.rubric.score(chain, results_list, stage_b_refs)
            for chain in chains
        ]

        passing_chains = [
            c for c in scored_chains
            if c.get("gate_score", 0.0) >= self.PASSING_THRESHOLD
        ]

        if passing_chains:
            primary = max(passing_chains, key=lambda c: c.get("gate_score", 0.0))
            independent = [
                r for r in results_list
                if r.get("agent") not in primary.get("converging_agents", [])
            ]
            output = {
                "gate_status": GateStatus.KILL_CHAIN_DETECTED,
                "gate_score": primary.get("gate_score", 0.0),
                "attestation_eligible": True,
                "primary_chain": primary,
                "all_passing_chains": passing_chains,
                "independent_vectors": independent,
                "rubric_breakdown": primary.get("rubric_breakdown", {}),
                "visible_logic_trace": self._compress_logic(primary, results_list),
                "final_decision": "HARDBLOCK",
                "co_inherence_cleared": True,
                "max_confidence": max(float(r.get("confidence", 0.0)) for r in results_list),
                "primary_risk_vector": primary.get("converging_agents", []),
                "evidence_chain": [
                    {
                        "agent": r.get("agent"),
                        "confidence": round(float(r.get("confidence", 0.0)), 4),
                        "finding": r.get("finding"),
                        "total_paths": r.get("total_paths_explored", 0)
                    }
                    for r in results_list
                ],
                "attestation_status": "CRYPTOGRAPHICALLY_VERIFIABLE_GRADE"
            }
            print(f"[Hepar Gate] KILL_CHAIN_DETECTED — score={primary.get('gate_score', 0.0):.4f}")
        else:
            max_conf = max((float(r.get("confidence", 0.0)) for r in results_list), default=0.0)
            best_score = max((c.get("gate_score", 0.0) for c in scored_chains), default=0.0)
            output = {
                "gate_status": GateStatus.HOLD_TENSION,
                "gate_score": best_score,
                "attestation_eligible": False,
                "primary_chain": None,
                "all_passing_chains": [],
                "independent_vectors": results_list,
                "rubric_breakdown": {},
                "visible_logic_trace": self._compress_logic_single(results_list),
                "final_decision": "ALLOW",
                "co_inherence_cleared": False,
                "max_confidence": max_conf,
                "primary_risk_vector": None,
                "evidence_chain": [
                    {
                        "agent": r.get("agent"),
                        "confidence": round(float(r.get("confidence", 0.0)), 4),
                        "finding": r.get("finding"),
                        "total_paths": r.get("total_paths_explored", 0)
                    }
                    for r in results_list
                ],
                "attestation_status": "HOLD_TENSION_NO_CHAIN"
            }
            print(f"[Hepar Gate] HOLD_TENSION — no chain cleared threshold.")

        return output

    def _compress_logic(self, chain: Dict, results: List[Dict]) -> str:
        steps = chain.get("chain_steps", [])
        agents = chain.get("converging_agents", [])
        score = chain.get("gate_score", 0.0)
        extraction = chain.get("total_estimated_extraction", 0)
        breakdown = chain.get("rubric_breakdown", {})

        step_lines = "\n".join([
            f"  Step {s.get('step', i)}: [{s.get('agent', '?')}] "
            f"{s.get('action', '?')} -> state:{s.get('contract_state_hash', '?')} "
            f"(${s.get('estimated_value_at_risk', 0):,.0f})"
            for i, s in enumerate(steps)
        ])

        rubric_lines = "\n".join([
            f"  {k}: {v:.4f}"
            for k, v in breakdown.items()
        ])

        return (
            f"KILL CHAIN DETECTED\n"
            f"Converging agents: {agents}\n"
            f"Gate score: {score:.4f} (threshold: {self.PASSING_THRESHOLD})\n"
            f"Estimated extraction: ${extraction:,.0f}\n\n"
            f"Chain path:\n{step_lines}\n\n"
            f"Rubric breakdown:\n{rubric_lines}"
        )

    def _compress_logic_single(self, results: List[Dict]) -> str:
        lines = "\n".join([
            f"  [{r.get('agent', '?')}] "
            f"confidence={float(r.get('confidence', 0.0)):.4f} "
            f"finding={r.get('finding', '?')}"
            for r in results
        ])
        return (
            f"HOLD_TENSION — No kill chain cleared threshold {self.PASSING_THRESHOLD}\n"
            f"Independent findings held in tension:\n{lines}\n"
            f"Each finding passed to Stage D as independent vectors."
        )

    def evaluate_co_inherence(self, agent_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        agent_findings = {r.get("agent"): r for r in agent_results}
        return self.synthesize(agent_findings)