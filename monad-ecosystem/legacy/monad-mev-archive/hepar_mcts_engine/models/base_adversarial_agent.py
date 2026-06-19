# # hepar_mcts_engine/agents/reentrancy_agent.py

import random
import copy
from typing import Dict, Any, List
from .base_adversarial_agent import BaseAdversarialAgent


class HeparReentrancyAgent(BaseAdversarialAgent):
    """
    Attempts callback vulnerabilities to drain funds.
    ATT&CK: T1499 Endpoint Denial via callback drain
    Reward: reentry_depth x funds_at_risk per callback
    MCTS deepens high-value drain paths.
    Thread count 10 — largest attack surface.
    MCTS depth 16 — callback chains can be long.
    """

    AGENT_NAME = "HeparReentrancyAgent"
    THREAD_COUNT = 10
    MCTS_DEPTH = 16
    BRANCHING_FACTOR = 5

    def __init__(self):
        super().__init__(domain_config={
            "reward_scale": 100.0,
            "attck_techniques": ["T1499", "T1486"]
        })
        self.load_attck_techniques(
            self.domain_config["attck_techniques"]
        )

    def get_possible_actions(
        self, state: Dict[str, Any]
    ) -> List[str]:
        return [
            "trigger_external_call_before_state_update",
            "recursive_callback_trigger",
            "cross_function_reentry",
            "cross_contract_reentry",
            "read_only_reentry",
            "callback_via_receive_function",
            "callback_via_fallback_function",
            "bypass_reentrancy_guard",
            "reenter_via_token_transfer",
            "multi_contract_callback_chain"
        ]

    def apply_action(
        self, state: Dict[str, Any], action: str
    ) -> Dict[str, Any]:
        new_state = copy.deepcopy(state)
        new_state["execution_step"] = (
            state.get("execution_step", 0) + 1
        )
        current_depth = state.get("reentry_depth", 0)
        current_balance = state.get("balance", 1_000_000)

        if action == "recursive_callback_trigger":
            new_state["reentry_depth"] = current_depth + 1
            new_state["funds_at_risk"] = (
                current_balance * 0.9
            )
            new_state["reentry_type"] = "RECURSIVE"

        elif action == "cross_function_reentry":
            new_state["reentry_depth"] = current_depth + 1
            new_state["funds_at_risk"] = (
                current_balance * 0.5
            )
            new_state["reentry_type"] = "CROSS_FUNCTION"

        elif action == "cross_contract_reentry":
            new_state["reentry_depth"] = current_depth + 1
            new_state["funds_at_risk"] = (
                current_balance * 0.7
            )
            new_state["reentry_type"] = "CROSS_CONTRACT"

        elif action == "bypass_reentrancy_guard":
            new_state["guard_bypassed"] = True
            new_state["reentry_depth"] = current_depth + 2
            new_state["funds_at_risk"] = (
                current_balance * 0.95
            )
            new_state["reentry_type"] = "GUARD_BYPASS"

        elif action == "read_only_reentry":
            new_state["reentry_depth"] = current_depth + 1
            new_state["funds_at_risk"] = (
                current_balance * 0.3
            )
            new_state["reentry_type"] = "READ_ONLY"

        elif action == "reenter_via_token_transfer":
            new_state["reentry_depth"] = current_depth + 1
            new_state["funds_at_risk"] = (
                current_balance * 0.6
            )
            new_state["reentry_type"] = "TOKEN_TRANSFER"

        elif action == "multi_contract_callback_chain":
            new_state["reentry_depth"] = current_depth + 3
            new_state["funds_at_risk"] = (
                current_balance * 0.8
            )
            new_state["reentry_type"] = "MULTI_CONTRACT"

        elif action == (
            "trigger_external_call_before_state_update"
        ):
            new_state["state_update_deferred"] = True
            new_state["funds_at_risk"] = (
                current_balance * 0.85
            )
            new_state["reentry_type"] = "CEI_VIOLATION"

        elif action in [
            "callback_via_receive_function",
            "callback_via_fallback_function"
        ]:
            new_state["reentry_depth"] = current_depth + 1
            new_state["funds_at_risk"] = (
                current_balance * 0.4
            )
            new_state["reentry_type"] = action.upper()

        new_state["estimated_value"] = new_state.get(
            "funds_at_risk", 0.0
        )
        new_state["state_hash"] = self._hash_state(
            new_state
        )
        return new_state

    def reward_signal(
        self, state: Dict[str, Any]
    ) -> float:
        depth = state.get("reentry_depth", 0)
        funds = state.get("funds_at_risk", 0.0)
        guard_bypassed = state.get("guard_bypassed", False)
        base = depth * (funds / 1_000_000)
        multiplier = 2.0 if guard_bypassed else 1.0
        return min(base * multiplier, 100.0)

    def stochastic_seed(
        self, base_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        seed = copy.deepcopy(base_state)
        seed["reentry_depth"] = 0
        seed["funds_at_risk"] = 0.0
        seed["guard_bypassed"] = False
        seed["balance"] = random.randint(
            10_000_000, 500_000_000
        )
        seed["execution_step"] = 0
        return seed

def seed_threads(
    self,
    base_state: 'ContractState',
    counterexamples: List[str],
    attck_techniques: List[str],
    n: int
) -> List['ContractState']:
    """
    Divergent seeding — three priority tiers:
    1. Stage B counterexample seeds (proven math failures)
    2. ATT&CK technique seeds (documented patterns)
    3. Domain stochastic seeds (unexplored state space)
    Zero-days live in tier 3 — tiers 1+2 calibrate MCTS globally.
    """
    seeds = []

    # Tier 1: Stage B counterexample seeds
    for cex_id in counterexamples:
        if len(seeds) >= n:
            break
        seed = base_state.copy()
        seed.counterexample_ref = cex_id
        seed.execution_step = 0
        seeds.append(seed)

    # Tier 2: ATT&CK technique seeds
    for technique_id in attck_techniques:
        if len(seeds) >= n:
            break
        seed = base_state.copy()
        seed.attck_technique_id = technique_id
        seed.execution_step = 0
        seeds.append(seed)

    # Tier 3: Domain stochastic (fill remaining slots)
    while len(seeds) < n:
        seeds.append(self.stochastic_seed(base_state))

    return seeds[:n]

def extract_best_path(self, root: 'MCTSNode') -> List['StepRecord']:
    """
    Walks highest-value path from root to terminal/leaf.
    Produces the step_map that KillChainDetector indexes.
    """
    from .models.contract_state import StepRecord
    path = []
    node = root
    step = 0

    while node.children:
        best = max(node.children, key=lambda c: c.value)
        if best.action and best.state:
            path.append(StepRecord(
                step=step,
                action=best.action,
                state_hash=self._hash_state(best.state),
                reward=best.value / max(best.visits, 1),
                execution_context=dict(best.state),
                attck_technique_id=best.state.get(
                    "attck_technique_id"
                ),
                estimated_value=best.state.get(
                    "estimated_value", 0.0
                )
            ))
        node = best
        step += 1

    return path

def _hash_state(self, state: Dict[str, Any]) -> str:
    import hashlib, json
    hashable = {
        k: state[k] for k in [
            "contract_address", "storage_slots",
            "current_caller", "call_depth",
            "balance", "execution_step"
        ] if k in state
    }
    return hashlib.sha256(
        json.dumps(hashable, sort_keys=True).encode()
    ).hexdigest()[:16]

def stochastic_seed(
    self, base_state: 'ContractState'
) -> 'ContractState':
    """
    Override in each domain agent for domain-specific
    stochastic entry point generation.
    Default: randomize caller address.
    """
    seed = base_state.copy()
    import random
    seed.current_caller = "0x" + "".join(
        random.choices("0123456789abcdef", k=40)
    )
    seed.execution_step = 0
    return seed
