# src/gnostic_engine.py - Updated to align with MOF v2.4.0 (Volumetric 4D Gnostic Engine)

from __future__ import annotations
from typing import Any
import time
import numpy as np

from ..generated.numerics import (
    FOCAL_LOCK_THRESHOLD,
    LANE_B_BLEND_RAW_WEIGHT,
    LANE_B_BLEND_VMASK_WEIGHT,
    LANE_C_KILL_RHCP_SPIN,
    LANE_C_KILL_HOST_RATIO,
    LANE_C_KILL_USER_RATIO,
    SPIN_EXPANDING_GATE,
    MAX_BLINKS,
)


class SynapticWatcher:
    """
    Tracks time-series values per var_id for temporal analysis.
    Used as the base for PulfrichWatcher.
    """

    def __init__(self) -> None:
        self.history: dict[str, list[tuple[float, float]]] = {}

    def track(self, var_id: str, value: float) -> None:
        now = time.time()
        self.history.setdefault(var_id, []).append((now, value))
        if len(self.history[var_id]) > 5:
            self.history[var_id].pop(0)


class PulfrichWatcher(SynapticWatcher):
    """
    Maintains a delayed mirror for Pulfrich phase tilt.
    We track discovery (A) and verification (B) on separate IDs.
    """

    def __init__(self, delay_ms: int = 10) -> None:
        super().__init__()
        self.delay_ms = delay_ms  # not used directly yet, but kept for tuning

    def get_elliptical_parallax(self, var_id: str) -> float:
        """
        Returns phase tilt (degrees) based on last two readings.
        If not enough history, returns 0.0.
        """
        history = self.history.get(var_id, [])
        if len(history) < 2:
            return 0.0

        discovery_now = history[-1][1]
        verification_delayed = history[-2][1]

        if verification_delayed == 0:
            return 0.0

        phase_tilt = np.arctan2(discovery_now, verification_delayed)
        return float(np.round(np.degrees(phase_tilt), 2))


class GnosticEngine:
    """
    Volumetric 4D Gnostic Engine with:
    - Stokes-Mueller coherence (Depth, Truth, Width)
    - Pulfrich phase tilt (temporal parallax)
    - Lane B V-mask integration (Bedrock bits)
    - Lane C magnitude kill-switch (blast radius)
    - Blink / Quarantine logic
    """

    def __init__(
        self,
        threshold: float = FOCAL_LOCK_THRESHOLD,
        max_blinks: int = MAX_BLINKS,
    ) -> None:
        self.threshold = threshold
        self.max_blinks = max_blinks
        self.history: dict[str, list[dict[str, float]]] = {}
        self.blink_registry: dict[str, int] = {}
        self.pulfrich = PulfrichWatcher()

    # ---------- Core math ----------

    def calculate_stokes(self, a: float, b: float, c: float) -> np.ndarray:
        """
        Stokes vector from lane intensities:
        a: Depth (Lane A)
        b: Truth (Lane B)
        c: Width / Spin (Lane C)
        """
        s0 = a + b + c
        s1 = a - b
        s2 = 0.0
        if a > 0 and b > 0:
            s2 = 2 * np.sqrt(a * b)
        s3 = c
        return np.array([s0, s1, s2, s3])

    def get_structural_read(self, stokes: np.ndarray, tilt_deg: float) -> float:
        """
        Final 4D Structural Read:
        SR = DoP * Pulfrich multiplier
        where DoP = sqrt(S1^2 + S2^2 + S3^2)/S0
        and Pulfrich multiplier = cos(tilt_deg).
        """
        s0, s1, s2, s3 = stokes
        if s0 == 0:
            return 0.0
        dop = np.sqrt(s1**2 + s2**2 + s3**2) / s0
        pulfrich_multiplier = np.cos(np.radians(tilt_deg))
        return float(np.round(dop * pulfrich_multiplier, 4))

    # ---------- Lane B: V-mask integration ----------

    def compute_lane_b_intensity(self, v_mask_bits: list[bool]) -> float:
        """
        Computes a 0-1 intensity for Lane B based on Bedrock V-mask bits:
        AUTH_CHAIN, PROV_ORIGIN, HIST_STABLE, etc.
        """
        if not v_mask_bits:
            return 0.0
        ones = sum(1 for b in v_mask_bits if b)
        return ones / len(v_mask_bits)

    # ---------- Lane C: magnitude kill-switch ----------

    def lane_c_kill_switch(
        self,
        spin: float,
        w_cong_active: bool,
        w_host_ratio: float | None = None,
        w_user_ratio: float | None = None,
    ) -> bool:
        """
        Lane C kill logic, based on:
        - RHCP spin (spin > 0.75) with contagion active (W_CONG = 0),
        - host coverage > 25%,
        - user coverage > 50%.
        """
        # RHCP high spin + contagion active
        if spin > LANE_C_KILL_RHCP_SPIN and not w_cong_active:
            return True

        # Too wide on infra
        if w_host_ratio is not None and w_host_ratio > LANE_C_KILL_HOST_RATIO:
            return True

        # Too wide on user base
        if w_user_ratio is not None and w_user_ratio > LANE_C_KILL_USER_RATIO:
            return True

        return False

    # ---------- Main processing ----------

    def process_packet(self, var_id: str, data: dict[str, Any]) -> dict[str, Any]:
        """
        Main entry point for Data-PBFP intake.

        Expected data keys:
        - lane_a: float          # Depth
        - lane_b: float          # Raw Truth score
        - lane_c: float          # Width / Spin
        - v_mask: list[bool]     # Lane B Bedrock bits (optional)
        - w_cong: bool           # Contagion bit (True = isolated, False = spreading)
        - w_host_ratio: float    # Fraction of infra affected (0-1, optional)
        - w_user_ratio: float    # Fraction of users affected (0-1, optional)
        """
        lane_a = float(data["lane_a"])
        lane_b_raw = float(data["lane_b"])
        lane_c = float(data["lane_c"])

        # Lane B: integrate Bedrock V-mask if present, then weight by the
        # manifold-derived LOGOC tier (Layer 7). The tier weight attenuates
        # Truth intensity for DIVERGENT / EMERGENT classifications; absent
        # (1.0) preserves the legacy unweighted blend exactly.
        v_mask = data.get("v_mask", [])
        lane_b_vmask = self.compute_lane_b_intensity(v_mask)
        lane_b_blend = (
            LANE_B_BLEND_RAW_WEIGHT * lane_b_raw
            + LANE_B_BLEND_VMASK_WEIGHT * lane_b_vmask
        )
        tier_weight = float(data.get("logoc_tier_weight", 1.0))
        lane_b = lane_b_blend * tier_weight

        # Lane C: magnitude kill-switch
        w_cong_active = bool(data.get("w_cong", True))
        w_host_ratio = data.get("w_host_ratio")
        w_user_ratio = data.get("w_user_ratio")

        if self.lane_c_kill_switch(
            spin=lane_c,
            w_cong_active=w_cong_active,
            w_host_ratio=w_host_ratio,
            w_user_ratio=w_user_ratio,
        ):
            return {
                "verdict": "MAGNITUDE_REJECT",
                "var": var_id,
                "reason": "Lane C Kill-Switch",
                "structural_read": 0.0,
                "phase_tilt": 0.0,
            }

        # Temporal history
        self.history.setdefault(var_id, []).append(
            {"lane_a": lane_a, "lane_b": lane_b, "lane_c": lane_c}
        )
        if len(self.history[var_id]) > 5:
            self.history[var_id].pop(0)

        # PulfrichWatcher history: track discovery (A) and verification (B)
        self.pulfrich.track(f"{var_id}_A", lane_a)
        self.pulfrich.track(f"{var_id}_B", lane_b)

        tilt = self.pulfrich.get_elliptical_parallax(f"{var_id}_A")

        stokes = self.calculate_stokes(lane_a, lane_b, lane_c)
        sr = self.get_structural_read(stokes, tilt)

        if sr < self.threshold:
            return self.trigger_blink(var_id, sr, tilt)

        # Layer 7: a boundary-adjacent packet (structural read in the
        # adjacent-convergent zone, flagged upstream) is forced to BLINK
        # even when sr >= threshold, so the blink registry accumulates and
        # repeated boundary incursions escalate to QUARANTINE. The scorer
        # runs upstream in routes.py and never throws; this is the gate.
        if data.get("boundary_adjacent"):
            return self.trigger_blink(var_id, sr, tilt, reason="BOUNDARY_ADJACENT")

        return self.resolve_success(var_id, sr, tilt, stokes[3])

    # ---------- Blink / success ----------

    def trigger_blink(
        self, var_id: str, sr: float, tilt: float, reason: str = "BLINK"
    ) -> dict[str, Any]:
        count = self.blink_registry.get(var_id, 0)
        if count >= self.max_blinks:
            return {
                "verdict": "QUARANTINE",
                "var": var_id,
                "reason": "COOLDOWN_EXHAUSTED",
                "structural_read": sr,
                "phase_tilt": tilt,
            }
        self.blink_registry[var_id] = count + 1
        return {
            "verdict": "BLINK",
            "var": var_id,
            "attempt": self.blink_registry[var_id],
            "reason": reason,
            "structural_read": sr,
            "phase_tilt": tilt,
        }

    def resolve_success(self, var_id: str, sr: float, tilt: float, spin: float) -> dict[str, Any]:
        status = "EXPANDING" if spin > SPIN_EXPANDING_GATE else "STABLE"
        return {
            "verdict": "FOCAL_LOCK",
            "var": var_id,
            "structural_read": sr,
            "phase_tilt": tilt,
            "momentum": status,
        }
