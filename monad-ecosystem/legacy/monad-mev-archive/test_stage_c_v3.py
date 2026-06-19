
# test_stage_c_v3.py

import asyncio
import json
from hepar_mcts_engine.orchestrator import (
    HeparStageCOrchestrator
)


async def run_smoke_test():
    print("=" * 60)
    print("HEPAR STAGE C v3.0 — SMOKE TEST")
    print("=" * 60)

    # ─────────────────────────────────────────────
    # SIMULATED CONTRACT PAYLOAD
    # Replace contractAddress, bytecode,
    # functionSignatures, storageSlots, and tvl
    # with a real contract when ready.
    # ─────────────────────────────────────────────
    contract_payload = {
        "protocolId": "TEST_PROTOCOL_001",
        "contractAddress": (
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        ),
        "bytecode": (
            "0x608060405234801561001057600080fd5b50"
        ),
        "functionSignatures": [
            "transfer(address,uint256)",
            "approve(address,uint256)",
            "transferFrom(address,address,uint256)",
            "mint(address,uint256)",
            "burn(uint256)",
            "upgradeTo(address)",
            "initialize(address)",
            "withdraw(uint256)",
            "deposit(uint256)",
            "flashLoan(address,uint256)"
        ],
        "storageSlots": {
            "owner": "0xdeadbeef" + "0" * 32,
            "initialized": True,
            "paused": False,
            "implementation": "0x1234" + "0" * 36,
            "totalSupply": 1_000_000_000,
            "reentrancyGuard": False
        },
        "deployer": "0xdeadbeef" + "0" * 32,
        "tvl": 50_000_000   # $50M TVL
    }

    # ─────────────────────────────────────────────
    # SIMULATED STAGE B COUNTEREXAMPLES
    # In production these come directly from
    # the symbolic prover output.
    # These seed the priority thread slots
    # in every agent — grounding MCTS in
    # proven mathematical failure points.
    # ─────────────────────────────────────────────
    stage_b_findings = {
        "status": "COUNTEREXAMPLE_FOUND",
        "counterexamples": [
            {
                "id": "cex_001",
                "invariant": "reentrancy_guard",
                "description": (
                    "Guard state not updated before "
                    "external call in withdraw(). "
                    "Callback can re-enter before "
                    "balance is decremented."
                )
            },
            {
                "id": "cex_002",
                "invariant": "accounting_math",
                "description": (
                    "Precision loss in share calculation "
                    "when balance < 1000. Rounding error "
                    "compounds across repeated deposits."
                )
            },
            {
                "id": "cex_003",
                "invariant": "proxy_upgrade_auth",
                "description": (
                    "upgradeProxy() missing onlyOwner "
                    "modifier in implementation contract. "
                    "Any caller can overwrite implementation."
                )
            }
        ]
    }

    # ─────────────────────────────────────────────
    # SIMULATED LIVE TELEMETRY
    # In production this comes from DefiLlama,
    # Snapshot, Tally, and on-chain feeds.
    # ─────────────────────────────────────────────
    telemetry = {
        "currentBlock": 22_450_000,
        "gasPrice": 15_000_000_000,
        "tvl_24h_change_percent": -2.3,
        "recent_large_transfers": 3,
        "governance_proposals_active": 1,
        "flashloan_volume_24h": 45_000_000,
        "unusual_wallet_activity": True
    }

    # ─────────────────────────────────────────────
    # PRINT TEST HEADER
    # ─────────────────────────────────────────────
    print(f"\nProtocol ID:   {contract_payload['protocolId']}")
    print(
        f"Contract:      "
        f"{contract_payload['contractAddress']}"
    )
    print(f"TVL:           ${contract_payload['tvl']:,}")
    print(
        f"Stage B CEX:   "
        f"{len(stage_b_findings['counterexamples'])} "
        f"counterexample(s)"
    )
    print(
        f"ATT&CK Seeds:  "
        f"Active via agent domain configs"
    )
    print(f"Telemetry:     Live snapshot injected")
    print("\n" + "-" * 60)
    print("Launching Stage C v3.0 orchestrator...")
    print("-" * 60 + "\n")

    # ─────────────────────────────────────────────
    # RUN THE FULL PIPELINE
    # ─────────────────────────────────────────────
    orchestrator = HeparStageCOrchestrator()

    result = await orchestrator.run(
        contract_payload=contract_payload,
        stage_b_findings=stage_b_findings,
        telemetry=telemetry
    )

    # ─────────────────────────────────────────────
    # PARSE RESULTS
    # ─────────────────────────────────────────────
    gate_output = result.get("gate_output", {})
    gate_status = gate_output.get("gate_status")
    gate_score = gate_output.get("gate_score", 0.0)
    attestation_eligible = gate_output.get(
        "attestation_eligible", False
    )
    final_decision = gate_output.get(
        "final_decision", "UNKNOWN"
    )

    # ─────────────────────────────────────────────
    # PRINT RESULTS
    # ─────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("STAGE C v3.0 — GATE OUTPUT")
    print("=" * 60)
    print(f"  Gate Status:          {gate_status}")
    print(f"  Gate Score:           {gate_score:.4f}")
    print(f"  Final Decision:       {final_decision}")
    print(
        f"  Attestation Eligible: {attestation_eligible}"
    )

    # ─────────────────────────────────────────────
    # KILL CHAIN OUTPUT
    # ─────────────────────────────────────────────
    if gate_status == "KILL_CHAIN_DETECTED":
        primary = gate_output.get("primary_chain", {})

        print("\n" + "─" * 60)
        print("  KILL CHAIN DETECTED")
        print("─" * 60)
        print(
            f"  Chain Length:          "
            f"{primary.get('chain_length', 0)} steps"
        )
        print(
            f"  Converging Agents:     "
            f"{primary.get('converging_agents', [])}"
        )
        print(
            f"  Est. Total Extraction: "
            f"${primary.get('total_estimated_extraction', 0):,.0f}"
        )
        print(
            f"  Convergence State:     "
            f"{primary.get('convergence_state_hash', '?')}"
        )

        print("\n  Rubric Breakdown:")
        for criterion, score in primary.get(
            "rubric_breakdown", {}
        ).items():
            bar_len = int(score * 20)
            bar = "█" * bar_len + "░" * (20 - bar_len)
            print(
                f"    {criterion[:42]:<42} "
                f"{bar} {score:.4f}"
            )

        print("\n  Kill Chain Steps:")
        for step in primary.get("chain_steps", []):
            print(
                f"    [{step.get('step', '?'):>2}] "
                f"[{step.get('agent', '?'):<30}] "
                f"{step.get('action', '?')}"
            )
            print(
                f"         state_hash: "
                f"{step.get('contract_state_hash', '?')} | "
                f"value: $"
                f"{step.get('estimated_value_at_risk', 0):,.0f}"
            )
            if step.get("attck_technique_id"):
                print(
                    f"         ATT&CK: "
                    f"{step.get('attck_technique_id')}"
                )

        print("\n  All Passing Chains:")
        for i, chain in enumerate(
            gate_output.get("all_passing_chains", [])
        ):
            print(
                f"    Chain {i+1}: "
                f"score={chain.get('gate_score', 0.0):.4f} | "
                f"agents="
                f"{chain.get('converging_agents', [])}"
            )

        print("\n  Visible Logic Trace:")
        print("  " + "-" * 40)
        trace = gate_output.get("visible_logic_trace", "")
        for line in trace.split("\n"):
            print(f"  {line}")

    # ─────────────────────────────────────────────
    # HOLD TENSION OUTPUT
    # ─────────────────────────────────────────────
    elif gate_status == "HOLD_TENSION":
        print("\n" + "─" * 60)
        print("  HOLD_TENSION — No kill chain cleared threshold")
        print("─" * 60)
        print(
            "  Contract shows no cross-domain convergence."
        )
        print(
            "  Independent findings passed to Stage D "
            "as single-vector risk signals."
        )
        print("\n  Independent Vectors:")
        for vec in gate_output.get(
            "independent_vectors", []
        ):
            conf = vec.get("confidence", 0.0)
            agent = vec.get("agent", "?")
            finding = vec.get("finding", "?")
            bar_len = int(conf * 20)
            bar = "█" * bar_len + "░" * (20 - bar_len)
            print(
                f"    [{agent:<30}] "
                f"{bar} {conf:.4f} — {finding}"
            )

        print("\n  Visible Logic Trace:")
        print("  " + "-" * 40)
        trace = gate_output.get("visible_logic_trace", "")
        for line in trace.split("\n"):
            print(f"  {line}")

    # ─────────────────────────────────────────────
    # EVIDENCE CHAIN — ALWAYS PRINTED
    # ─────────────────────────────────────────────
    print("\n" + "─" * 60)
    print("  EVIDENCE CHAIN (All 5 Agents)")
    print("─" * 60)
    for entry in gate_output.get("evidence_chain", []):
        conf = entry.get("confidence", 0.0)
        bar_len = int(conf * 20)
        bar = "█" * bar_len + "░" * (20 - bar_len)
        print(
            f"  [{entry.get('agent', '?'):<30}] "
            f"{bar} {conf:.4f}"
        )
        print(
            f"    Finding: {entry.get('finding', '?')} | "
            f"Paths: {entry.get('total_paths', 0):,}"
        )

    # ─────────────────────────────────────────────
    # STAGE B COUNTEREXAMPLES USED
    # ─────────────────────────────────────────────
    cex_used = result.get(
        "stage_b_counterexamples_used", []
    )
    print(f"\n  Stage B Seeds Used: {cex_used}")

    # ─────────────────────────────────────────────
    # PASS / FAIL DETERMINATION
    # ─────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("SMOKE TEST VALIDATION")
    print("=" * 60)

    checks = {
        "Orchestrator ran without error": (
            result.get("stage_c_status") == "COMPLETE"
        ),
        "Gate status returned": (
            gate_status in [
                "KILL_CHAIN_DETECTED", "HOLD_TENSION"
            ]
        ),
        "Gate score is numeric": (
            isinstance(gate_score, float)
        ),
        "Evidence chain populated": (
            len(gate_output.get("evidence_chain", [])) > 0
        ),
        "All 5 agents ran": (
            len(gate_output.get("evidence_chain", [])) == 5
        ),
        "Attestation flag set": (
            isinstance(attestation_eligible, bool)
        ),
        "Visible logic trace present": (
            bool(gate_output.get("visible_logic_trace"))
        ),
        "Stage B seeds injected": (
            len(cex_used) > 0
        )
    }

    all_passed = True
    for check, passed in checks.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status}  {check}")
        if not passed:
            all_passed = False

    print("\n" + "=" * 60)
    if all_passed:
        print("  ✅ ALL CHECKS PASSED")
        print("  Stage C v3.0 is OPERATIONAL")
    else:
        print("  ❌ SOME CHECKS FAILED")
        print("  Review output above for failures")
    print("=" * 60)

    # ─────────────────────────────────────────────
    # WRITE FULL OUTPUT TO FILE
    # Inspect stage_c_test_output.json for
    # full kill chain payload detail
    # ─────────────────────────────────────────────
    output_file = "stage_c_test_output.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2, default=str)

    print(f"\n  Full output written to: {output_file}")
    print(
        "  Open this file to inspect the complete "
        "kill chain payload before Stage D wiring.\n"
    )

    return all_passed


if __name__ == "__main__":
    passed = asyncio.run(run_smoke_test())
    exit(0 if passed else 1)
