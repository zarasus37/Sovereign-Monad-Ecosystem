# api/gnostic_bridge.py
#
# Gnostic Bridge — HEPAR → SGE relay
#
# Maps a HEPAR opportunity payload (Python dict) into the SGE
# lane format and calls POST /intake/forage on the local FastAPI instance.
#
# Lane mapping rationale:
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
FORAGE_ENDPOINT = f"{SGE_BASE_URL}/intake/forage"
# MAX_TVL_REFERENCE is imported from the canonical numerics module (Layer 4a)
# — $500M TVL normalization ceiling. Do not redeclare here.


# ---------------------------------------------------------------------------
# Return type
# ---------------------------------------------------------------------------

class GnosisResult(TypedDict):
    verdict: str            # FOCAL_LOCK | BLINK | QUARANTINE | MAGNITUDE_REJECT | UNAVAILABLE
    structural_read: float  # 0–1 coherence score
    phase_tilt: float       # degrees of temporal parallax
    momentum: Optional[str] # STABLE | EXPANDING | None
    logoc_tier: Optional[str]          # forwarded TTCL tier if present in opportunity
    boundary_adjacent: bool            # TTCL boundary-adjacent flag if forwarded
    available: bool         # False when SGE API is unreachable → stub fallback


# ---------------------------------------------------------------------------
# Lane mapping
# ---------------------------------------------------------------------------

def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def _build_packet(opportunity: Dict[str, Any], var_id: str) -> Dict[str, Any]:
    """
    Translate a HEPAR opportunity dict into SGE lane inputs.

    Expected HEPAR keys (all optional with safe defaults):
      tvl                     float   — total value locked (USD)
      aggregate_risk          float   — 0–100 composite risk score from HEPAR
      adversarial_risk        float   — 0–100 adversarial sub-score
      critical_audit_findings int     — unresolved critical audit findings
      top10_holder_pct        float   — % concentration of top-10 holders
      honeypot_probability    float   — 0–1
      v_mask                  list[bool] — optional Bedrock V-mask bits
      logoc_tier              str     — optional TTCL gnosis tier label
      boundary_adjacent       bool    — optional TTCL boundary flag
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

    return {
        "var_id": var_id,
        "lane_a": lane_a,
        "lane_b": lane_b,
        "lane_c": lane_c,
        "v_mask": v_mask,
        "w_cong": w_cong,
        "w_host_ratio": w_host_ratio,
        "w_user_ratio": w_user_ratio,
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
    return GnosisResult(
        verdict="UNAVAILABLE",
        structural_read=0.0,
        phase_tilt=0.0,
        momentum=None,
        logoc_tier=opportunity.get("logoc_tier"),
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
    Main entry point.

    Args:
        opportunity: HEPAR opportunity dict (see _build_packet for keys).
        var_id:      Identifier for the packet (defaults to opportunity 'id').
        timeout:     HTTP timeout in seconds. If SGE is down, returns stub.

    Returns:
        GnosisResult dict with verdict, coherence score, and TTCL passthrough.
    """
    _var_id = var_id or str(opportunity.get("id", "unknown"))
    packet = _build_packet(opportunity, _var_id)

    try:
        raw = _post_json(FORAGE_ENDPOINT, packet, timeout=timeout)
    except (urllib.error.URLError, TimeoutError, ConnectionRefusedError, OSError):
        return _stub_result(_var_id, opportunity)

    verdict = raw.get("verdict", "UNAVAILABLE")

    return GnosisResult(
        verdict=verdict,
        structural_read=float(raw.get("structural_read", 0.0)),
        phase_tilt=float(raw.get("phase_tilt", 0.0)),
        momentum=raw.get("momentum"),
        logoc_tier=opportunity.get("logoc_tier"),
        boundary_adjacent=bool(opportunity.get("boundary_adjacent", False)),
        available=True,
    )


# ---------------------------------------------------------------------------
# Standalone test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    test_cases = [
        {
            "label": "Clean opportunity (FOCAL_LOCK expected)",
            "opportunity": {
                "id": "test_opp_001",
                "tvl": 50_000_000,
                "aggregate_risk": 15.0,
                "adversarial_risk": 5.0,
                "critical_audit_findings": 0,
                "top10_holder_pct": 28.0,
                "honeypot_probability": 0.02,
                "v_mask": [True, True, True, False, True],
                "logoc_tier": "COHERENT",
                "boundary_adjacent": False,
            },
        },
        {
            "label": "High-risk opportunity (QUARANTINE / MAGNITUDE_REJECT expected)",
            "opportunity": {
                "id": "test_opp_002",
                "tvl": 2_000_000,
                "aggregate_risk": 88.0,
                "adversarial_risk": 92.0,
                "critical_audit_findings": 3,
                "top10_holder_pct": 78.0,
                "honeypot_probability": 0.65,
                "v_mask": [False, False, False],
                "logoc_tier": "EMERGENT",
                "boundary_adjacent": True,
            },
        },
        {
            "label": "SGE offline fallback (stub expected)",
            "opportunity": {
                "id": "test_opp_003",
                "tvl": 10_000_000,
                "aggregate_risk": 30.0,
                "adversarial_risk": 20.0,
            },
        },
    ]

    for case in test_cases:
        label = case["label"]
        opp = case["opportunity"]
        print(f"\n--- {label} ---")
        print(f"  var_id: {opp.get('id')}")
        print(f"  Packet:")
        pkt = _build_packet(opp, str(opp.get("id", "?")))
        for k, v in pkt.items():
            if k != "var_id":
                print(f"    {k}: {v}")
        result = call_gnosis_bridge(opp, timeout=3)
        print(f"  Result:")
        for k, v in result.items():
            print(f"    {k}: {v}")

    print("\n[Bridge test complete]")
    sys.exit(0)
