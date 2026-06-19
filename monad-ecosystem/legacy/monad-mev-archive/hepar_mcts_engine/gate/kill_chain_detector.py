# hepar_mcts_engine/gate/kill_chain_detector.py

from collections import defaultdict
from typing import Dict, List, Any


class KillChainDetector:
    """
    Core scan logic for cross-agent state-space convergence.

    Algorithm:
    1. Extract step-level state hashes from all 5 agent findings
    2. Build unified state index keyed by state_hash
    3. Find hashes referenced by 2+ agents — convergence points
    4. Reconstruct minimal execution path through convergence points
    5. Merge overlapping chains into composite kill chains
    """

    def scan(
        self,
        agent_findings: Dict[str, Any]
    ) -> List[Dict[str, Any]]:

        # Step 1: Extract state timelines from all agents
        state_timelines = {}
        for agent_name, finding in agent_findings.items():
            if hasattr(finding, 'extract_state_timeline'):
                state_timelines[agent_name] = \
                    finding.extract_state_timeline()
            elif isinstance(finding, dict):
                state_timelines[agent_name] = \
                    finding.get("step_map", [])

        # Step 2: Build unified state index
        # key: state_hash
        # value: list of {agent, step, action, context, value}
        state_index = defaultdict(list)
        for agent_name, timeline in state_timelines.items():
            for entry in timeline:
                state_hash = entry.get("state_hash")
                if state_hash:
                    state_index[state_hash].append({
                        "agent": agent_name,
                        "step": entry.get("step", 0),
                        "action": entry.get("action", ""),
                        "execution_context": entry.get(
                            "execution_context", {}
                        ),
                        "estimated_value": entry.get(
                            "estimated_value", 0.0
                        ),
                        "attck_technique_id": entry.get(
                            "attck_technique_id"
                        ),
                        "reward": entry.get("reward", 0.0)
                    })

        # Step 3: Find convergence points
        # Any state_hash seen by 2+ agents = candidate
        convergence_points = {
            state_hash: entries
            for state_hash, entries in state_index.items()
            if len({e["agent"] for e in entries}) >= 2
        }

        if not convergence_points:
            return []

        # Step 4: Reconstruct kill chains
        candidates = []
        for state_hash, entries in convergence_points.items():
            chain = self._reconstruct_chain(
                state_hash,
                entries,
                state_timelines
            )
            if chain:
                candidates.append(chain)

        # Step 5: Merge overlapping chains
        return self._merge_chains(candidates)

    def _reconstruct_chain(
        self,
        convergence_hash: str,
        converging_entries: List[Dict],
        state_timelines: Dict[str, List]
    ) -> Dict[str, Any]:
        """
        Builds the kill chain steps leading to convergence point.
        Orders by execution step across all contributing agents.
        """
        chain_steps = []
        converging_agents = list(
            {e["agent"] for e in converging_entries}
        )

        # Build pre-convergence path from each agent
        for agent_name in converging_agents:
            timeline = state_timelines.get(agent_name, [])
            for entry in timeline:
                chain_steps.append({
                    "step": entry.get("step", 0),
                    "agent": agent_name,
                    "action": entry.get("action", ""),
                    "contract_state_hash": entry.get(
                        "state_hash", ""
                    ),
                    "execution_context": entry.get(
                        "execution_context", {}
                    ),
                    "estimated_value_at_risk": entry.get(
                        "estimated_value", 0.0
                    ),
                    "attck_technique_id": entry.get(
                        "attck_technique_id"
                    ),
                    "is_convergence_point": (
                        entry.get("state_hash") == convergence_hash
                    )
                })

        # Sort by step number
        chain_steps.sort(key=lambda x: x["step"])

        total_value = sum(
            s["estimated_value_at_risk"] for s in chain_steps
        )

        return {
            "chain_steps": chain_steps,
            "converging_agents": converging_agents,
            "convergence_state_hash": convergence_hash,
            "chain_length": len(chain_steps),
            "total_estimated_extraction": total_value,
            "gate_score": 0.0  # Scored by rubric next
        }

    def _merge_chains(
        self,
        candidates: List[Dict]
    ) -> List[Dict]:
        """
        Merges chains sharing convergence points into
        composite kill chains. Removes duplicates.
        """
        if not candidates:
            return []

        merged = []
        seen_hashes = set()

        for chain in sorted(
            candidates,
            key=lambda c: len(c["converging_agents"]),
            reverse=True
        ):
            h = chain["convergence_state_hash"]
            if h not in seen_hashes:
                merged.append(chain)
                seen_hashes.add(h)

        return merged