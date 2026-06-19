# hepar_mcts_engine/orchestrator.py
import asyncio
import logging
from typing import Dict, Any, List

from .agents.privilege_agent import HeparPrivilegeAgent
from .agents.arithmetic_agent import HeparArithmeticAgent
from .agents.reentrancy_agent import HeparReentrancyAgent
from .agents.economic_agent import HeparEconomicAgent
from .agents.state_agent import HeparStateAgent
from .gate.hepar_adversarial_gate import HeparAdversarialGate

logger = logging.getLogger(__name__)


class HeparStageCOrchestrator:
    """Central coordinator for Stage C v3.0.
    Runs all 5 agents concurrently then feeds the adversarial gate.
    """

    def __init__(self, contract_meta: dict = None, stage_b_seeds: list = None):
        self.contract_meta = contract_meta or {
            "address":            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "tvl":                50_000_000,
            "initial_state_hash": "f12f27ffcd1e0f0b",
            "stage_b_seeds":      ["cex_001", "cex_002", "cex_003"],
        }
        self.stage_b_seeds = stage_b_seeds or self.contract_meta.get("stage_b_seeds", [])

        self.agents = {
            "HeparPrivilegeAgent":   HeparPrivilegeAgent(contract_meta=self.contract_meta,  stage_b_seeds=self.stage_b_seeds),
            "HeparArithmeticAgent":  HeparArithmeticAgent(contract_meta=self.contract_meta, stage_b_seeds=self.stage_b_seeds),
            "HeparReentrancyAgent":  HeparReentrancyAgent(contract_meta=self.contract_meta, stage_b_seeds=self.stage_b_seeds),
            "HeparEconomicAgent":    HeparEconomicAgent(contract_meta=self.contract_meta,   stage_b_seeds=self.stage_b_seeds),
            "HeparStateAgent":       HeparStateAgent(contract_meta=self.contract_meta,      stage_b_seeds=self.stage_b_seeds),
        }
        self.gate = HeparAdversarialGate()

    # ── main pipeline ─────────────────────────────────────────────────────────

    async def run(
        self,
        contract_payload: Dict[str, Any],
        stage_b_findings: Dict[str, Any] = None,
        telemetry:        Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """Full Stage C execution pipeline.
        Returns gate output ready for Stage D consumption.
        """
        if stage_b_findings is None:
            stage_b_findings = {}
        if telemetry is None:
            telemetry = {}

        protocol_id = contract_payload.get("protocolId", "UNKNOWN")
        logger.info(f"Stage C Orchestrator: Starting v3.0 run for protocol {protocol_id}")

        counterexamples = self._extract_counterexamples(stage_b_findings)
        logger.info(f"Stage C Orchestrator: {len(counterexamples)} counterexamples injected as priority thread seeds")

        initial_state = self._build_initial_state(contract_payload, telemetry)

        # ── run all 5 agents concurrently ─────────────────────────────────────
        logger.info("Stage C Orchestrator: Launching 5 agents concurrently...")

        agent_tasks = {
            name: asyncio.to_thread(
                agent.run_campaign,
                initial_state=initial_state,
                n_threads=getattr(agent, "THREAD_COUNT", 10),
                time_limit_sec=30,
            )
            for name, agent in self.agents.items()
        }

        results = await asyncio.gather(*agent_tasks.values(), return_exceptions=True)

        # ── collect findings and step traces separately ───────────────────────
        agent_findings = {}   # full result dicts — used for display / evidence chain
        agent_steps    = {}   # step lists only  — fed to the gate

        for name, result in zip(agent_tasks.keys(), results):
            if isinstance(result, Exception):
                logger.error(f"Stage C Orchestrator: Agent {name} failed — {result}")
                agent_findings[name] = {
                    "agent":                  name,
                    "confidence":             0.0,
                    "finding":                "AGENT_ERROR",
                    "total_paths_explored":   0,
                    "step_map":               [],
                    "counterexample_ref":     None,
                }
                agent_steps[name] = []
            else:
                agent_findings[name] = result
                # ── THE FIX: extract step_map list, not the full result dict ──
                agent_steps[name] = result.get("step_map", [])
                logger.info(
                    f"Stage C Orchestrator: {name} complete — "
                    f"confidence={result.get('confidence', 0.0):.4f} "
                    f"paths={result.get('total_paths_explored', 0)} "
                    f"steps_for_gate={len(agent_steps[name])}"
                )

        # ── run adversarial gate with step traces ─────────────────────────────
        logger.info("Stage C Orchestrator: All agents complete. Running adversarial gate...")

        gate_output = self.gate.synthesize(
            agent_steps,                    # ← step lists, not finding dicts
            stage_b_refs=counterexamples,
        )

        logger.info(
            f"Stage C Orchestrator: Gate complete — "
            f"status={gate_output.get('gate_status')} "
            f"score={gate_output.get('gate_score', 0.0):.4f} "
            f"attestation_eligible={gate_output.get('attestation_eligible')}"
        )

        return {
            "protocol_id":               protocol_id,
            "stage_c_status":            "COMPLETE",
            "gate_output":               gate_output,
            "agent_findings":            agent_findings,
            "stage_b_counterexamples_used": counterexamples,
            "telemetry_snapshot":        telemetry,
        }

    # ── helpers ───────────────────────────────────────────────────────────────

    def _extract_counterexamples(self, stage_b_findings: Dict[str, Any]) -> List[str]:
        """Extract counterexample IDs from Stage B output.
        These become priority thread seeds in every agent.
        """
        counterexamples = []

        if isinstance(stage_b_findings, list):
            for f in stage_b_findings:
                if isinstance(f, dict):
                    cex_id = f.get("counterexampleId") or f.get("id")
                    if cex_id:
                        counterexamples.append(str(cex_id))

        elif isinstance(stage_b_findings, dict):
            raw = stage_b_findings.get("counterexamples", [])
            for cex in raw:
                if isinstance(cex, dict):
                    cex_id = cex.get("id") or cex.get("counterexampleId")
                    if cex_id:
                        counterexamples.append(str(cex_id))
                elif isinstance(cex, str):
                    counterexamples.append(cex)

        return counterexamples

    def _build_initial_state(
        self,
        contract_payload: Dict[str, Any],
        telemetry:        Dict[str, Any],
    ) -> Dict[str, Any]:
        """Builds the initial contract state dict shared across all agents
        as their base seed. Each agent's seed_threads method produces
        divergent copies from this base.
        """
        return {
            "contract_address":     contract_payload.get("contractAddress", "0x0"),
            "bytecode":             contract_payload.get("bytecode", ""),
            "storage_slots":        contract_payload.get("storageSlots", {}),
            "function_signatures":  contract_payload.get("functionSignatures", []),
            "current_caller":       contract_payload.get("deployer", "0x" + "0" * 40),
            "call_depth":           0,
            "balance":              int(contract_payload.get("tvl", 1_000_000)),
            "execution_step":       0,
            "is_terminal":          False,
            "block_number":         telemetry.get("currentBlock", 0),
            "telemetry_snapshot":   telemetry,
            # state tracking fields
            "access_level":                 "NONE",
            "precision_drift":              0.0,
            "arithmetic_error":             "NONE",
            "reentry_depth":                0,
            "funds_at_risk":                0.0,
            "mev_extraction":               0.0,
            "state_inconsistency_entropy":  0.0,
            "estimated_value":              0.0,
        }