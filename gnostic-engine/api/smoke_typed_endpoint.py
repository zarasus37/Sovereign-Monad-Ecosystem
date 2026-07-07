# api/smoke_typed_endpoint.py
#
# Layer 7.6 → 7.7 gate smoke.
#
# Proves the typed `/api/v1/gnosis/process` endpoint is stable under a REAL
# HEPAR opportunity shape BEFORE the bridge migrates off `/intake/forage`.
# Reuses gnostic_bridge._build_packet for the exact lane derivation HEPAR
# uses in production, then POSTs to the typed endpoint with the new Layer 7
# enrichment inputs (narrative + tvl + boundary_adjacent + trace) and asserts
# the response carries the derived logoc_tier + constitution verdict.
#
# This is the manual smoke the co-architect gated L7.7 on: green tests are
# necessary but not sufficient — a real HEPAR payload must round-trip the
# typed path before /intake/forage is deprecated.
#
# Usage (server must be up on :8001, e.g. from gnostic-engine/api/):
#   uvicorn gnostic_api:app --port 8001
# then:
#   python smoke_typed_endpoint.py
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

# Import the production lane-mapping from the bridge (same dir on sys.path).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gnostic_bridge import _build_packet  # noqa: E402

TYPED_ENDPOINT = "http://localhost:8001/api/v1/gnosis/process"


def _post_json(url: str, payload: dict, timeout: int = 5) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _typed_packet(opportunity: dict, agent_id: str) -> dict:
    """Build a typed-endpoint payload from a HEPAR opportunity.

    Reuses the bridge's _build_packet lane derivation, then:
      - renames var_id → agent_id (the typed endpoint's key)
      - drops the legacy `logoc_tier` passthrough (the typed endpoint
        DERIVES the tier from the narrative now — that's the L7.6 change)
      - adds the new Layer 7 inputs: narrative, tvl, boundary_adjacent, trace
    """
    pkt = _build_packet(opportunity, agent_id)
    pkt.pop("var_id", None)

    # Realistic audit-finding narrative → classifies to a manifold tier.
    # The bridge used to forward `logoc_tier` as an opaque string the legacy
    # endpoint ignored; the typed path derives it from this narrative.
    narrative = opportunity.get(
        "narrative",
        "this single token bridge is a causal trace of a reentrancy possibility",
    )
    pkt.update(
        {
            "agent_id": agent_id,
            "narrative": narrative,
            "tvl": opportunity.get("tvl"),
            "boundary_adjacent": bool(opportunity.get("boundary_adjacent", False)),
            "trace": opportunity.get("trace"),
        }
    )
    return pkt


def _check(label: str, cond: bool, detail: str = "") -> bool:
    mark = "PASS" if cond else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + detail) if detail else ''}")
    return cond


def main() -> int:
    # A realistic, well-formed HEPAR opportunity (clean contract, low risk,
    # fully Bedrock-v-masked) with a CHARTER §4 trace + audit narrative.
    #
    # NOTE (discovered by this smoke): the bridge's standalone test cases
    # label top10_holder_pct=28 as "Clean (FOCAL_LOCK expected)" — but that
    # was calibrated against the LEGACY /intake/forage path (VolumetricScanner,
    # which has no Lane C kill-switch). The TYPED engine enforces
    # LANE_C_KILL_HOST_RATIO=0.25, so 28% trips MAGNITUDE_REJECT. The typed
    # path is stricter; a genuinely clean HEPAR opportunity keeps holder
    # concentration below 25%. This mismatch must be reconciled in L7.7.
    clean_opp = {
        "id": "hepar-0xdeadbeef-clean",
        "tvl": 50_000_000,
        "aggregate_risk": 15.0,
        "adversarial_risk": 5.0,
        "critical_audit_findings": 0,
        "top10_holder_pct": 20.0,   # < 0.25 kill threshold → typed path FOCAL_LOCKs
        "honeypot_probability": 0.02,
        "v_mask": [True, True, True, False, True],
        "boundary_adjacent": False,
        "trace": {
            "intentionId": "intent-hepar-001",
            "source": "hepar.audit.completed",
            "constraintEnvelopeId": "ce-aurora-7",
            "narrativePurposeId": "np-deploy-gated",
        },
    }

    print("=" * 72)
    print("L7.6 -> L7.7 gate smoke: real HEPAR shape -> typed /api/v1/gnosis/process")
    print("=" * 72)

    # ── Case 1: clean opportunity, classified + scored ────────────────────────
    print("\n[1] Clean HEPAR opportunity (expect FOCAL_LOCK + derived COHERENT tier)")
    payload = _typed_packet(clean_opp, "hepar-clean-1")
    print("  derived lanes:", {k: round(v, 4) if isinstance(v, float) else v
                               for k, v in payload.items()
                               if k in ("lane_a", "lane_b", "lane_c",
                                        "w_host_ratio", "w_user_ratio")})
    try:
        r = _post_json(TYPED_ENDPOINT, payload)
    except (urllib.error.URLError, ConnectionRefusedError, OSError) as e:
        print(f"  [FAIL] server unreachable on {TYPED_ENDPOINT} — {e}")
        print("  Start it:  cd gnostic-engine/api && uvicorn gnostic_api:app --port 8001")
        return 2

    ok = True
    ok &= _check("verdict is FOCAL_LOCK", r.get("verdict") == "FOCAL_LOCK",
                 f"got {r.get('verdict')}")
    ok &= _check("logoc_tier derived (not None)", r.get("logoc_tier") is not None,
                 f"got {r.get('logoc_tier')!r}")
    ok &= _check("constitution_score present", r.get("constitution_score") is not None,
                 f"got {r.get('constitution_score')}")
    ok &= _check("constitution_pass is False (single-domain by design)",
                 r.get("constitution_pass") is False)
    ok &= _check("domain_incomplete is True on the wire",
                 r.get("domain_incomplete") is True)
    ok &= _check("momentum present", r.get("momentum") in ("STABLE", "EXPANDING"),
                 f"got {r.get('momentum')!r}")
    print("  response:", json.dumps({k: r[k] for k in (
        "verdict", "overall_score", "logoc_tier", "constitution_score",
        "constitution_pass", "domain_incomplete", "momentum") if k in r},
        indent=2))

    # ── Case 2: boundary_adjacent forces BLINK over a FOCAL_LOCK-grade read ──
    print("\n[2] boundary_adjacent=True on a clean packet (expect BLINK, sr >= threshold)")
    boundary_opp = dict(clean_opp, id="hepar-0xdeadbeef-boundary", boundary_adjacent=True)
    r2 = _post_json(TYPED_ENDPOINT, _typed_packet(boundary_opp, "hepar-boundary-1"))
    from gnostic_engine.generated.numerics import FOCAL_LOCK_THRESHOLD  # noqa: E402
    ok &= _check("verdict is BLINK", r2.get("verdict") == "BLINK",
                 f"got {r2.get('verdict')}")
    ok &= _check("overall_score still >= FOCAL_LOCK_THRESHOLD (forced-divert)",
                 r2.get("overall_score", 0) >= FOCAL_LOCK_THRESHOLD,
                 f"sr={r2.get('overall_score')}")
    print("  response:", json.dumps({k: r2[k] for k in (
        "verdict", "overall_score", "logoc_tier", "constitution_score") if k in r2}))

    # ── Case 3: repeat boundary incursions → QUARANTINE ───────────────────────
    print("\n[3] Repeat boundary incursions (expect escalation to QUARANTINE)")
    from gnostic_engine.generated.numerics import MAX_BLINKS  # noqa: E402
    aid = "hepar-quarantine-1"
    qopp = dict(clean_opp, boundary_adjacent=True)
    for i in range(MAX_BLINKS):
        rb = _post_json(TYPED_ENDPOINT, _typed_packet(qopp, aid))
        print(f"  blink {i+1}/{MAX_BLINKS}: verdict={rb.get('verdict')}")
    r3 = _post_json(TYPED_ENDPOINT, _typed_packet(qopp, aid))
    ok &= _check("escalates to QUARANTINE after MAX_BLINKS",
                 r3.get("verdict") == "QUARANTINE", f"got {r3.get('verdict')}")

    # ── Case 4: trace survives onto the durable log (replay) ──────────────────
    print("\n[4] CHARTER §4 trace reconstructable via /api/v1/audit/replay")
    with urllib.request.urlopen(
        urllib.request.Request(
            "http://localhost:8001/api/v1/audit/replay",
            headers={"Accept": "application/json"},
        ),
        timeout=5,
    ) as resp:
        replay = json.loads(resp.read().decode("utf-8"))
    events = replay.get("events", [])
    traced = [e for e in events if e.get("trace") and
              e.get("trace", {}).get("intentionId") == "intent-hepar-001"]
    ok &= _check("trace-bearing events present in the durable log",
                 len(traced) >= 1, f"{len(traced)} event(s)")
    if traced:
        t = traced[0]
        ok &= _check("constitution_score carried into the stored event payload",
                     "constitution_score" in (t.get("payload") or {}))

    print("\n" + ("=" * 72))
    print("RESULT: " + ("ALL GATES PASSED — L7.7 unblocked" if ok
                        else "GATES FAILED — do NOT migrate the bridge"))
    print("=" * 72)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())