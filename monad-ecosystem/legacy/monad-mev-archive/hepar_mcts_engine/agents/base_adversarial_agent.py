# hepar/agents/base_adversarial_agent.py
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
import hashlib
import random

_PLATEAU_WINDOW   = 50
_MAX_STEPS        = 500
_SOLO_RUNAWAY_CAP = 300

class BaseAdversarialAgent(ABC):

    MAX_SOLO_CONSECUTIVE_STEPS = 500
    REWARD_PLATEAU_WINDOW = 50
    REWARD_PLATEAU_THRESHOLD = 0.005  # 0.5% improvement minimum

    # Stage B seed → action mapping (shared across all agents)
    SEED_ACTION_MAP = {
        "cex001": [
            "multicontractcallbackchain", "recursivecallbacktrigger",
            "callbackviareceivefunction", "readonlyreentry",
            "triggerexternalcallbeforestateupdate", "multicontractcallbackchain..."
        ],
        "cex002": [
            "overflowuint256addition", "underflowuint256subtraction",
            "uncheckedarithmeticblock", "dividebynearzero",
            "precisionlossinsharescalculation", "castuint256touint128truncation",
            "multiplybeforedivide", "feecalculationtruncation",
            "accumulateroundingerror"
        ],
        "cex003": [
            "bypassonlyOwnermodifier", "spoofmsgsendertoowner",
            "callupgradeProxy", "callviaproxydelegatecall",
            "callgrantRole", "calltransferOwnership", "callsetAdmin",
            "callrenounceOwnership", "callrenounceOwnership"
        ],
    }

    def __init__(self, name: str, contract_meta: dict,
                 stage_b_seeds: List[str] = None, num_threads: int = 8):
        self.name = name
        self.contract_meta = contract_meta
        self.stage_b_seeds = stage_b_seeds or []
        self.num_threads = num_threads
        self._reward_history: List[float] = []

    def _tag_seed_ref(self, action: str) -> Optional[str]:
        """Return which Stage B counterexample seed this action traces back to."""
        action_clean = action.replace("...", "").strip()
        for seed_id, actions in self.SEED_ACTION_MAP.items():
            if action_clean in actions:
                # Only tag if that seed was actually injected this run
                if not self.stage_b_seeds or seed_id in self.stage_b_seeds:
                    return seed_id
        return None

    def _check_reward_plateau(self) -> bool:
        """Return True if reward has stopped improving — signal to terminate rollout."""
        if len(self._reward_history) >= _PLATEAU_WINDOW:
            recent = self._reward_history[-_PLATEAU_WINDOW:]
            if max(recent) - min(recent) < 0.001:
                return True
            if recent[0] != 0:
                delta = (recent[-1] - recent[0]) / abs(recent[0])
                return delta < self.REWARD_PLATEAU_THRESHOLD
        return False

    def _check_solo_runaway(self, steps: list) -> bool:
        """Return True if this agent has been running solo too long."""
        if len(steps) < _SOLO_RUNAWAY_CAP:
            return False
        recent = steps[-_SOLO_RUNAWAY_CAP:]
        return all(s.get("agent_name") == self.name for s in recent)

    def _build_step(self, action: str, state_hash: str, reward: float,
                    estimated_value: float, attck_id: str,
                    execution_context: dict, chain_tail: bool = False) -> dict:
        """Build a fully-tagged MCTS step with Stage B seed reference."""
        seed_ref = self._tag_seed_ref(action)
        self._reward_history.append(reward)
        return {
            "agent_name": self.name,
            "action": action,
            "state_hash": state_hash,
            "reward": reward,
            "estimated_value": estimated_value,
            "attck_technique_id": attck_id,
            "execution_context": execution_context,
            "stage_b_seed_ref": seed_ref,        # FIX 1 — was always null
            "counterexample_ref": seed_ref,       # FIX 1 — was always null
            "chain_tail_label": "supporting_technical_evidence" if chain_tail else "primary_kill_chain",
        }

    def _generate_state_hash(self, prev_hash: str, action: str) -> str:
        raw = f"{prev_hash}:{action}:{random.random()}"
        return hashlib.md5(raw.encode()).hexdigest()[:16]

    @abstractmethod
    def run_campaign(self) -> dict:
        pass