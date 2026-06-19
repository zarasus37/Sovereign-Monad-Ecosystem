# hepar_mcts_engine/models/contract_state.py

import hashlib
import json
import copy
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional


@dataclass
class ContractState:
    contract_address: str
    bytecode: str
    storage_slots: Dict[str, Any]
    function_signatures: List[str]
    current_caller: str
    call_depth: int
    balance: int
    execution_step: int
    is_terminal: bool = False
    counterexample_ref: Optional[str] = None
    attck_technique_id: Optional[str] = None
    block_number: Optional[int] = None
    telemetry_snapshot: Optional[Dict[str, Any]] = None

    def state_hash(self) -> str:
        """
        Deterministic hash of contract state.
        This is the ONLY key KillChainDetector uses
        for cross-agent convergence detection.
        Must be identical across agents if they reach
        the same state via different paths.
        """
        hashable = {
            "address": self.contract_address,
            "storage": self.storage_slots,
            "caller": self.current_caller,
            "call_depth": self.call_depth,
            "balance": self.balance,
            "step": self.execution_step
        }
        return hashlib.sha256(
            json.dumps(hashable, sort_keys=True).encode()
        ).hexdigest()[:16]

    def copy(self) -> 'ContractState':
        return ContractState(
            contract_address=self.contract_address,
            bytecode=self.bytecode,
            storage_slots=copy.deepcopy(self.storage_slots),
            function_signatures=list(self.function_signatures),
            current_caller=self.current_caller,
            call_depth=self.call_depth,
            balance=self.balance,
            execution_step=self.execution_step,
            is_terminal=self.is_terminal,
            counterexample_ref=self.counterexample_ref,
            attck_technique_id=self.attck_technique_id,
            block_number=self.block_number,
            telemetry_snapshot=copy.deepcopy(self.telemetry_snapshot)
            if self.telemetry_snapshot else None
        )


@dataclass
class StepRecord:
    """
    Step-level record from MCTS best path.
    state_hash is what KillChainDetector indexes.
    """
    step: int
    action: str
    state_hash: str
    reward: float
    execution_context: Dict[str, Any]
    attck_technique_id: Optional[str] = None
    estimated_value: float = 0.0


@dataclass  
class AgentFinding:
    agent_name: str
    confidence: float
    step_map: List[StepRecord]
    counterexample_ref: Optional[str]
    total_paths_explored: int
    estimated_impact_value: float
    finding: str
    in_chain: bool = False
    attck_techniques_triggered: List[str] = field(default_factory=list)

    def extract_state_timeline(self) -> List[Dict[str, Any]]:
        """
        Extracts state hash timeline for KillChainDetector.
        This is the exact method the gate calls on every finding.
        """
        return [
            {
                "state_hash": s.state_hash,
                "step": s.step,
                "agent": self.agent_name,
                "action": s.action,
                "execution_context": s.execution_context,
                "reward": s.reward,
                "estimated_value": s.estimated_value,
                "attck_technique_id": s.attck_technique_id
            }
            for s in self.step_map
        ]