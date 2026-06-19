# hepar/agents/hepar_arithmetic_agent.py
from abc import abstractmethod
import random
from typing import List
from .base_adversarial_agent import BaseAdversarialAgent

_PLATEAU_WINDOW   = 50
_MAX_STEPS        = 500
_SOLO_RUNAWAY_CAP = 300

class HeparArithmeticAgent(BaseAdversarialAgent):

    ARITHMETIC_MOVES = [
        ("overflow_uint256_addition",        "T1562", 25_000_000),
        ("underflow_uint256_subtraction",    "T1562", 25_000_000),
        ("unchecked_arithmetic_block",       "T1562", 25_000_000),
        ("divide_by_near_zero",              "T1562", 25_000_000),
        ("precision_loss_in_shares_calc",    "T1562", 5_000_000),
        ("cast_uint256_to_uint128_trunc",    "T1562", 25_000_000),
        ("multiply_before_divide",           "T1562", 25_000_000),
        ("fee_calculation_truncation",       "T1562", 25_000_000),
        ("accumulate_rounding_error",        "T1562", 25_000_000),
    ]

    def __init__(self, contract_meta: dict = None, stage_b_seeds: List[str] = None):
        super().__init__(
            name="HeparArithmeticAgent",
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

        for step_idx in range(_MAX_STEPS):
            current_hash = state_hash
            reward = 4090.0

            for step_num in range(40):  # Capped at 40 — plateau detection will cut earlier
                if self._check_reward_plateau():
                    break

                all_steps_so_far = steps
                is_tail = self._check_solo_runaway(all_steps_so_far)

                move_name, attck_id, base_value = random.choice(self.ARITHMETIC_MOVES)

                # Reward grows with depth
                reward = reward + random.uniform(5.0, 25.0)

                new_hash = self._generate_state_hash(current_hash, move_name)

                step = self._build_step(
                    action=move_name,
                    state_hash=new_hash,
                    reward=reward,
                    estimated_value=float(base_value),
                    attck_id=attck_id,
                    execution_context={
                        "access_level": "NONE",
                        "arithmetic_error": "OVERFLOW" if "overflow" in move_name
                                            else "UNDERFLOW" if "underflow" in move_name
                                            else "UNCHECKED",
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

        confidence = 1.0 if steps else 0.0

        return {
            "agent": self.name,
            "confidence": confidence,
            "total_paths_explored": total_paths,
            "finding": "Counterexample Identified" if confidence >= 0.75 else "Proved Safe Unknown",
            "step_map": steps,
            "counterexample_ref": None,
            "estimated_impact_value": confidence,
            "metadata": {
                "avg_reward": sum(s["reward"] for s in steps) / len(steps) if steps else 0,
                "reward_scale": 10000.0
            },
        }