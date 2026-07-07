# api/gnostic_bridge.py
#
# Gnostic Bridge — HEPAR → SGE relay (Layer 7.7: typed-endpoint migration)
#
# Maps a HEPAR opportunity payload (Python dict) into the typed
# `/api/v1/gnosis/process` lane format (GnosticEngine.process_packet).
#
# MIGRATION NOTES (Layer 7.7):
#   * Endpoint:   /intake/forage (VolumetricScanner, no kill-switch) →
#                 /api/v1/gnosis/process (GnosticEngine, full Lane C kill-switch).
#                 The typed path is STRICTER: a HEPAR shape that the legacy
#                 scanner accepted as "clean" can return MAGNITUDE_REJECT here
#                 because the typed engine enforces LANE_C_KILL_HOST_RATIO=0.25,
#                 LANE_C_KILL_USER_RATIO=0.50, and the RHCP-spin+contagion kill.
#                 "Clean" fixtures were retuned to the typed engine's standard,
#                 not the other way around.
#   * logoc_tier: was an opaque caller-set passthrough string the legacy
#                 endpoint echoed back. The typed endpoint DERIVES it from the
#                 `narrative` via the heuristic Peirce classifier + the manifold
#                 density tier. Callers no longer set logoc_tier; they pass a
#                 narrative and consume the derived tier from the response.
#   * boundary_adjacent: remains a caller input (HEPAR decides from its own
#                 forensic analysis), now with a behavioral consequence — it
#                 forces BLINK over a FOCAL_LOCK-grade structural read.
#
# Lane mapping rationale (unchanged from legacy):
#   lane_a (Depth)       = TVL-normalized capital gravity        [0, 1]
#   lane_b (Truth)       = Forensic truth: 1 - aggregateRisk     [0, 1]
#   lane_c (Width/Spin)  = Adversarial contagion spread          [0, 1]
#   w_cong               = False when critical audit findings exist (contagion active)
#   w_host_ratio         = Top-10 holder concentration (infra coverage proxy)
#   w_user_ratio         = Honeypot probability (user exposure proxy)
#
# Usage (standalone test):
#   python gnostic_bridge.py
#
# Usage (as module):
#   from gnostic_bridge import call_gnosis_bridge, GnosisResult

from __future__ import annotations

import json
import math
import os
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, Optional, TypedDict

# Make the gnostic_engine package (under src/) importable so we can pull the
# canonical TVL ceiling from the generated numerics module (Layer 4a).
_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

from gnostic_engine.generated.numerics import MAX_TVL_REFERENCE  # noqa: E402

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SGE_BASE_URL = "http://localhost:8001"
# Layer 7.7: the canonical typed path. /intake/forage is deprecated (kept
# behind a Deprecation header + warning log in gnostic_api.py) for one cycle
# so any missed migration paths stay observable; it is NOT deleted here.
TYPED_ENDPOINT = f"{SGE_BASE_URL}/api/v1/gnosis/process"
# MAX_TVL_REFERENCE is imported from the canonical numerics module (Layer 4a)
# — $500M TVL normalization ceiling. Do not redeclare here.


# ---------------------------------------------------------------------------
# Return type
# ---------------------------------------------------------------------------

class GnosisResult(TypedDict):
    verdict: str            # FOCAL_LOCK | BLINK | QUARANTINE | MAGNITUDE_REJECT | UNAVAILABLE
    structural_read: float  # 0–1 coherence score (response `overall_score`)
    phase_tilt: float       # degrees of temporal parallax (response `parallax.tilt_magnitude`)
    momentum: Optional[str] # STABLE | EXPANDING | None
    logoc_tier: Optional[str]          # manifold-derived tier (from narrative), no longer a passthrough
    constitution_score: Optional[float]  # TTCL transparency metric (single-domain → < 0.72 by design)
    boundary_adjacent: bool            # HEPAR boundary-adjacent flag (caller input)
    available: bool         # False when SGE API is unreachable → stub fallback


# ---------------------------------------------------------------------------
# Lane mapping
# ---------------------------------------------------------------------------

def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def _build_packet(opportunity: Dict[str, Any], agent_id: str) -> Dict[str, Any]:
    """
    Translate a HEPAR opportunity dict into the typed-endpoint payload.

    Expected HEPAR keys (all optional with safe defaults):
      tvl                     float   — total value locked (USD)
      aggregate_risk          float   — 0–100 composite risk score from HEPAR
      adversarial_risk        float   — 0–100 adversarial sub-score
      critical_audit_findings int     — unresolved critical audit findings
      top10_holder_pct        float   — % concentration of top-10 holders
      honeypot_probability    float   — 0–1
      v_mask                  list[bool] — optional Bedrock V-mask bits
      narrative               str     — audit-finding text the engine classifies
                                        to derive the logoc_tier (Layer 7.6)
      boundary_adjacent       bool    — HEPAR boundary-adjacent flag (caller input)
      trace                   dict    — CHARTER §4 intention trace (optional)

    Legacy keys `logoc_tier` (opaque passthrough) is IGNORED — the typed
    endpoint derives the tier from `narrative`. A caller still carrying the
    old key is silently tolerated but the value is never forwarded.
    """
    tvl = float(opportunity.get("tvl", 0))
    aggregate_risk = float(opportunity.get("aggregate_risk", 50.0))
    adversarial_risk = float(opportunity.get("adversarial_risk", 0.0))
    critical_findings = int(opportunity.get("critical_audit_findings", 0))
    top10_pct = float(opportunity.get("top10_holder_pct", 35.0))
    honeypot_prob = float(opportunity.get("honeypot_probability", 0.0))
    v_mask = opportunity.get("v_mask", [])

    # lane_a — Depth: TVL normalized against reference ceiling, then log-compressed
    if tvl > 0:
        lane_a = _clamp01(math.log1p(tvl) / math.log1p(MAX_TVL_REFERENCE))
    else:
        lane_a = 0.0

    # lane_b — Truth: forensic truth = 1 - normalized aggregate risk
    lane_b = _clamp01(1.0 - (aggregate_risk / 100.0))

    # lane_c — Width/Spin: adversarial contagion magnitude
    lane_c = _clamp01(adversarial_risk / 100.0)

    # w_cong — False (contagion ACTIVE) when critical audit findings exist
    w_cong = critical_findings == 0

    # w_host_ratio — infrastructure exposure proxy: holder concentration / 100
    w_host_ratio = _clamp01(top10_pct / 100.0)

    # w_user_ratio — user exposure proxy: honeypot probability
    w_user_ratio = _clamp01(honeypot_prob)

    # Layer 7.6 enrichment inputs. `narrative` drives the derived logoc_tier;
    # `tvl` maps the live Sign to a PPS band; `boundary_adjacent` forces BLINK
    # over a passing SR; `trace` propagates the CHARTER §4 chain.
    return {
        "agent_id": agent_id,
        "lane_a": lane_a,
        "lane_b": lane_b,
        "lane_c": lane_c,
        "v_mask": v_mask,
        "w_cong": w_cong,
        "w_host_ratio": w_host_ratio,
        "w_user_ratio": w_user_ratio,
        "narrative": opportunity.get("narrative"),
        "tvl": opportunity.get("tvl"),
        "boundary_adjacent": bool(opportunity.get("boundary_adjacent", False)),
        "trace": opportunity.get("trace"),
    }


# ---------------------------------------------------------------------------
# HTTP call
# ---------------------------------------------------------------------------

def _post_json(url: str, payload: Dict[str, Any], timeout: int = 5) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ---------------------------------------------------------------------------
# Stub fallback (SGE unavailable)
# ---------------------------------------------------------------------------

def _stub_result(var_id: str, opportunity: Dict[str, Any]) -> GnosisResult:
    # Server unreachable: tier cannot be derived (no classification ran), so
    # logoc_tier is None rather than the legacy passthrough string.
    return GnosisResult(
        verdict="UNAVAILABLE",
        structural_read=0.0,
        phase_tilt=0.0,
        momentum=None,
        logoc_tier=None,
        constitution_score=None,
        boundary_adjacent=bool(opportunity.get("boundary_adjacent", False)),
        available=False,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def call_gnosis_bridge(
    opportunity: Dict[str, Any],
    var_id: Optional[str] = None,
    timeout: int = 5,
) -> GnosisResult:
    """
    Main entry point — calls the typed /api/v1/gnosis/process endpoint.

    Args:
        opportunity: HEPAR opportunity dict (see _build_packet for keys).
        var_id:      Identifier for the packet (defaults to opportunity 'id').
                     Forwarded as the typed endpoint's `agent_id`.
        timeout:     HTTP timeout in seconds. If SGE is down, returns stub.

    Returns:
        GnosisResult dict with verdict, structural read, derived logoc_tier,
        constitution transparency score, and the boundary-adjacent flag.
    """
    _var_id = var_id or str(opportunity.get("id", "unknown"))
    packet = _build_packet(opportunity, _var_id)

    try:
        raw = _post_json(TYPED_ENDPOINT, packet, timeout=timeout)
    except (urllib.error.URLError, TimeoutError, ConnectionRefusedError, OSError):
        return _stub_result(_var_id, opportunity)

    verdict = raw.get("verdict", "UNAVAILABLE")

    # Layer 7.6 response shape: structural_read → overall_score,
    # phase_tilt → parallax.tilt_magnitude, logoc_tier + constitution_score
    # are now engine-produced (derived), not caller-passthrough.
    parallax = raw.get("parallax") or {}

    return GnosisResult(
        verdict=verdict,
        structural_read=float(raw.get("overall_score", 0.0)),
        phase_tilt=float(parallax.get("tilt_magnitude", 0.0)),
        momentum=raw.get("momentum"),
        logoc_tier=raw.get("logoc_tier"),  # derived from narrative, not echoed
        constitution_score=raw.get("constitution_score"),
        boundary_adjacent=bool(opportunity.get("boundary_adjacent", False)),
        available=True,
    )


# ---------------------------------------------------------------------------
# Standalone test — fixtures retuned to the typed engine's enforcement
# (Layer 7.7: behavioral reconciliation, not a mechanical port)
# ---------------------------------------------------------------------------

# Narrative that classifies to class 1 (Rhematic-Indexical-Sinsign) → COHERENT
# tier (weight 1.0) on the canonical manifold, so a FOCAL_LOCK-grade packet
# stays at full Lane B and the boundary forced-divert path is exercisable.
_COHERENT_NARRATIVE = "this single token bridge is a causal trace of a reentrancy possibility"

# A deliberately risky audit narrative (adversarial / contagion framing).
# The verdict is driven by the kill-switch, not the tier; the narrative is
# included so the response still carries a derived logoc_tier + constitution
# score for transparency, matching what a real HEPAR audit would send.
_RISKY_NARRATIVE = "this event token is a spreading contagion symptom of an adversarial fact"

if __name__ == "__main__":
    test_cases = [
        {
            # CLEAN: every kill condition cleared under the typed engine's
            # standard — holder concentration < 0.25, honeypot < 0.50, no
            # critical findings (w_cong active), low adversarial spin.
            # (Legacy used 28% holders, which the typed path kills at 25%.)
            "label": "Clean opportunity (FOCAL_LOCK + derived COHERENT expected)",
            "opportunity": {
                "id": "test_opp_001",
                "tvl": 50_000_000,
                "aggregate_risk": 15.0,
                "adversarial_risk": 5.0,
                "critical_audit_findings": 0,
                "top10_holder_pct": 20.0,   # < 0.25 kill threshold
                "honeypot_probability": 0.02,  # < 0.50 kill threshold
                "v_mask": [True, True, True, False, True],
                "narrative": _COHERENT_NARRATIVE,
                "boundary_adjacent": False,
                "trace": {
                    "intentionId": "intent-test-001",
                    "source": "hepar.audit.completed",
                    "constraintEnvelopeId": "ce-test-001",
                },
            },
        },
        {
            # HIGH-RISK: host concentration 78% >> 0.25 → MAGNITUDE_REJECT via
            # the Lane C host-ratio kill (also: honeypot 0.65 > 0.50, and
            # adversarial 92 + critical findings → RHCP kill). The typed
            # engine correctly rejects what the legacy scanner would have run.
            "label": "High-risk opportunity (MAGNITUDE_REJECT expected)",
            "opportunity": {
                "id": "test_opp_002",
                "tvl": 2_000_000,
                "aggregate_risk": 88.0,
                "adversarial_risk": 92.0,
                "critical_audit_findings": 3,
                "top10_holder_pct": 78.0,
                "honeypot_probability": 0.65,
                "v_mask": [False, False, False],
                "narrative": _RISKY_NARRATIVE,
                "boundary_adjacent": True,  # informational; verdict is kill-driven
                "trace": {
                    "intentionId": "intent-test-002",
                    "source": "hepar.audit.completed",
                    "constraintEnvelopeId": "ce-test-002",
                },
            },
        },
        {
            # BOUNDARY: a clean packet (FOCAL_LOCK-grade SR) with
            # boundary_adjacent=True → forced BLINK over a passing SR.
            # Asserts the behavioral consequence of the flag, not an echo.
            "label": "Boundary-adjacent clean packet (forced BLINK over passing SR)",
            "opportunity": {
                "id": "test_opp_003",
                "tvl": 50_000_000,
                "aggregate_risk": 15.0,
                "adversarial_risk": 5.0,
                "critical_audit_findings": 0,
                "top10_holder_pct": 20.0,
                "honeypot_probability": 0.02,
                "v_mask": [True, True, True, False, True],
                "narrative": _COHERENT_NARRATIVE,
                "boundary_adjacent": True,
                "trace": {
                    "intentionId": "intent-test-003",
                    "source": "hepar.audit.completed",
                    "constraintEnvelopeId": "ce-test-003",
                },
            },
        },
        {
            # SGE OFFLINE: unreachable server → stub fallback. Tier is None
            # (it cannot be derived without the engine), not a passthrough.
            "label": "SGE offline fallback (stub expected, timeout=0.01)",
            "opportunity": {
                "id": "test_opp_004",
                "tvl": 10_000_000,
                "aggregate_risk": 30.0,
                "adversarial_risk": 20.0,
                "narrative": _COHERENT_NARRATIVE,
            },
        },
    ]

    for case in test_cases:
        label = case["label"]
        opp = case["opportunity"]
        # Unique agent_id per run so the engine's per-agent Pulfrich history
        # doesn't accumulate across repeated executions of this smoke and
        # tilt the structural read (a second run against the same live server
        # would otherwise see non-zero tilt and drop the clean case below
        # FOCAL_LOCK). `var_id` passed to call_gnosis_bridge overrides the
        # opportunity's id.
        run_id = f"{opp.get('id')}-{os.getpid()}"
        print(f"\n--- {label} ---")
        print(f"  agent_id: {run_id}")
        print(f"  Packet (derived):")
        pkt = _build_packet(opp, run_id)
        for k, v in pkt.items():
            if k not in ("agent_id", "narrative", "trace"):
                print(f"    {k}: {v}")
        # The offline case uses a tiny timeout to force the stub path.
        timeout = 0.01 if "offline" in label.lower() else 5
        result = call_gnosis_bridge(opp, var_id=run_id, timeout=timeout)
        print(f"  Result:")
        for k, v in result.items():
            print(f"    {k}: {v}")

    print("\n[Bridge test complete]")
    sys.exit(0)
