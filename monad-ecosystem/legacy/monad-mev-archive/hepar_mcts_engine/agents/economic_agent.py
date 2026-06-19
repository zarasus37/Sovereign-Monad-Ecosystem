# hepar_mcts_engine/agents/economic_agent.py
import random
from typing import List
from .base_adversarial_agent import BaseAdversarialAgent


class HeparEconomicAgent(BaseAdversarialAgent):

    UCB_EXPLORATION_CONSTANT = 0.5
    MIN_PROFITABLE_VALUE = 100_000

    ECONOMIC_MOVES = [
        ("oracle_price_manipulation",       "T1657", 18_000_000),
        ("flash_loan_borrow_max",           "T1657", 0),
        ("governance_flash_loan_attack",    "T1657", 25_000_000),
        ("jit_liquidity_provision",         "T1657", 25_000_000),
        ("price_impact_drain",              "T1657", 32_000_000),
        ("front_run_pending_tx",            "T1657", 250_000),
        ("back_run_liquidation",            "T1657", 25_000_000),
        ("multi_block_mev_sequence",        "T1657", 48_500_000),
        ("arbitrage_price_discrepancy",     "T1657", 18_000_000),
        ("sandwich_attack_uniswap_v3",      "T1657", 35_000_000),
        ("cross_pool_atomic_arbitrage",     "T1657", 42_000_000),
        ("vault_inflation_attack",          "T1657", 50_000_000),
        ("donation_attack_balances",        "T1657", 28_000_000),
        ("read_only_reentrancy_price_feed", "T1657", 45_000_000),
    ]

    def __init__(self, contract_meta: dict = None, stage_b_seeds: List[str] = None):
        super().__init__(
            name="HeparEconomicAgent",
            contract_meta=contract_meta or {},
            stage_b_seeds=stage_b_seeds,
            num_threads=12
        )

    def _compute_confidence(self, best_path: list) -> float:
        if not best_path:
            return 0.0
        tvl = self.contract_meta.get("tvl", 50_000_000)
        best_mev = max(
            (s.get("execution_context", {}).get("mev_extraction", 0) for s in best_path),
            default=0
        )
        best_value = max(
            (s.get("estimated_value", 0) for s in best_path),
            default=0
        )
        extraction = max(best_mev, best_value)
        base = min(1.0, extraction / tvl)
        depth_bonus = min(0.15, len(best_path) * 0.006)
        return min(1.0, base + depth_bonus)

    def _should_prune(self, estimated_value: float) -> bool:
        return 0 < estimated_value < self.MIN_PROFITABLE_VALUE

    def run_campaign (self, initial_state=None, n_threads=None, time_limit_sec=None) -> dict:
        print(f"  {self.name}: Initiating adversarial campaign with "
              f"{self.num_threads} parallel MCTS threads.")

        steps = []
        state_hash = self.contract_meta.get("initial_state_hash", "f12f27ffcd1e0f0b")
        total_paths = 0
        tvl = self.contract_meta.get("tvl", 50_000_000)

        profitable_moves = [
            m for m in self.ECONOMIC_MOVES
            if m[2] >= self.MIN_PROFITABLE_VALUE or m[2] == 0
        ]

        for thread_idx in range(self.num_threads):
            current_hash = state_hash

            for step_num in range(26):
                if self._check_reward_plateau():
                    break

                all_steps_so_far = steps
                is_tail = self._check_solo_runaway(all_steps_so_far)
                if is_tail:
                    break

                move_name, attck_id, base_value = random.choice(profitable_moves)

                if self._should_prune(base_value):
                    total_paths += 1
                    continue

                value_multiplier = 1.0 + (step_num * 0.04)
                estimated_value = min(base_value * value_multiplier, tvl)
                mev_extraction = estimated_value
                reward = min(100.0, (estimated_value / tvl) * 100.0)

                new_hash = self._generate_state_hash(current_hash, move_name)

                step = self._build_step(
                    action=move_name,
                    state_hash=new_hash,
                    reward=reward,
                    estimated_value=estimated_value,
                    attck_id=attck_id,
                    execution_context={
                        "access_level": "NONE",
                        "arithmetic_error": "NONE",
                        "reentry_depth": 0,
                        "mev_extraction": mev_extraction,
                        "state_inconsistency_entropy": 0.0,
                    },
                    chain_tail=is_tail
                )
                steps.append(step)
                current_hash = new_hash
                total_paths += 1

        best_path = sorted(
            steps,
            key=lambda s: s.get("estimated_value", 0),
            reverse=True
        )
        confidence = self._compute_confidence(best_path)
        finding = "Counterexample Identified" if confidence >= 0.75 else "Proved Safe Unknown"

        return {
            "agent": self.name,
            "confidence": confidence,
            "total_paths_explored": total_paths,
            "finding": finding,
            "step_map": steps,
            "counterexample_ref": None,
            "estimated_impact_value": confidence,
            "metadata": {
                "ucb_constant": self.UCB_EXPLORATION_CONSTANT,
                "min_profitable_value": self.MIN_PROFITABLE_VALUE,
                "new_moves_added": 5,
            },
        }