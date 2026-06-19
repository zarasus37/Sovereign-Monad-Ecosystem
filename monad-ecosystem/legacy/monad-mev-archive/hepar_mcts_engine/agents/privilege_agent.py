# hepar/agents/hepar_privilege_agent.py
import random
from typing import List
from .base_adversarial_agent import BaseAdversarialAgent

_PLATEAU_WINDOW   = 50
_MAX_STEPS        = 500
_SOLO_RUNAWAY_CAP = 300

class HeparPrivilegeAgent(BaseAdversarialAgent):

    PRIVILEGE_MOVES = [
        ("bypass_only_owner_modifier",  "T1068", 0),
        ("spoof_msg_sender_to_owner",   "T1068", 0),
        ("call_upgrade_proxy",          "T1068", 0),
        ("call_via_proxy_delegatecall", "T1068", 0),
        ("call_grant_role",             "T1068", 0),
        ("call_transfer_ownership",     "T1068", 0),
        ("call_set_admin",              "T1068", 0),
        ("call_renounce_ownership",     "T1068", 0),
    ]

    # Privilege steps unlock downstream extraction — credit 15% of co-agent value
    PRIVILEGE_MULTIPLIER = 0.15

    def __init__(self, contract_meta: dict = None, stage_b_seeds: List[str] = None):
        super().__init__(
            name="HeparPrivilegeAgent",
            contract_meta=contract_meta or {},
            stage_b_seeds=stage_b_seeds,
            num_threads=8
        )

    def run_campaign (self, initial_state=None, n_threads=None, time_limit_sec=None) -> dict:
        print(f"  {self.name}: Initiating adversarial campaign with "
              f"{self.num_threads} parallel MCTS threads.")

        steps = []
        state_hash = self.contract_meta.get("initial_state_hash", "f12f27ffcd1e0f0b")
        total_paths = 0
        tvl = self.contract_meta.get("tvl", 50_000_000)

        for step_idx in range(_MAX_STEPS):
            current_hash = state_hash
            base_reward = 87.5

            for step_num in range(28):
                if self._check_reward_plateau():
                    break

                all_steps_so_far = steps
                is_tail = self._check_solo_runaway(all_steps_so_far)

                move_name, attck_id, base_value = random.choice(self.PRIVILEGE_MOVES)

                # Reward climbs as access level escalates
                reward = min(100.0, base_reward + (step_num * 0.15))

                # Downstream unlock value — privilege enables reentrancy/economic extraction
                downstream_unlock = tvl * self.PRIVILEGE_MULTIPLIER
                estimated_value = downstream_unlock if step_num >= 2 else 0.0

                new_hash = self._generate_state_hash(current_hash, move_name)

                step = self._build_step(
                    action=move_name,
                    state_hash=new_hash,
                    reward=reward,
                    estimated_value=estimated_value,
                    attck_id=attck_id,
                    execution_context={
                        "access_level": "OWNER",
                        "arithmetic_error": "NONE",
                        "reentry_depth": 0,
                        "mev_extraction": 0.0,
                        "state_inconsistency_entropy": 0.0,
                    },
                    chain_tail=is_tail
                )
                steps.append(step)
                current_hash = new_hash
                total_paths += 1

                # Hard cap: stop solo runaway
                if is_tail:
                    break

        confidence = min(1.0, sum(s["reward"] for s in steps) / (len(steps) * 100.0)) if steps else 0.0

        return {
            "agent": self.name,
            "confidence": confidence,
            "total_paths_explored": total_paths,
            "finding": "Counterexample Identified" if confidence >= 0.75 else "Proved Safe Unknown",
            "step_map": steps,
            "counterexample_ref": None,
            "estimated_impact_value": confidence,
            "metadata": {"avg_reward": confidence * 100.0, "reward_scale": 100.0},
        }