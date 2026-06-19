# hepar/tier3_report_generator.py
from datetime import datetime
import json

MITRE_TECHNIQUE_MAP = {
    "reentrancy": "T1190 - Exploit Public-Facing Application",
    "flash_loan": "T1562 - Impair Defenses (Liquidity Manipulation)",
    "access_control": "T1548 - Abuse Elevation Control Mechanism",
    "oracle_manipulation": "T1565 - Data Manipulation",
    "integer_overflow": "T1203 - Exploitation for Client Execution"
}

def generate_tier3_report(gate_result: dict, contract_meta: dict) -> dict:
    kill_chains = gate_result.get("kill_chains", [])
    findings = []

    for kc in kill_chains:
        technique = MITRE_TECHNIQUE_MAP.get(kc.get("vector", ""), "T0000 - Unknown")
        findings.append({
            "id": kc.get("id"),
            "severity": kc.get("severity", "HIGH"),
            "vector": kc.get("vector"),
            "mitre_technique": technique,
            "exploit_path": kc.get("exploit_steps", []),
            "estimated_loss_usd": kc.get("estimated_loss_usd", "UNKNOWN"),
            "proof_of_concept_available": kc.get("poc_available", False),
            "remediation": kc.get("remediation", "Pending manual review")
        })

    return {
        "report_type": "TIER_3_FORENSIC_INTELLIGENCE",
        "classification": "CONFIDENTIAL — NDA REQUIRED",
        "generated": datetime.utcnow().isoformat() + "Z",
        "target_contract": contract_meta.get("address"),
        "chain": contract_meta.get("chain"),
        "gate_cleared": gate_result.get("gate_passed"),
        "confidence_score": gate_result.get("gate_score"),
        "attestation_hash": gate_result.get("attestation_hash"),
        "total_kill_chains": len(kill_chains),
        "findings": findings,
        "autonomous_exploit_intelligence": True,
        "sovereign_monad_build": "Hepar-StageC-v3.0"
    }