# api/gnostic_api.py

from collections import Counter
import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np

# Make sure we can import from src/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))
from gnostic_engine import (
    VolumetricScanner,
    structural_resonance,
    resonance_index,
    volumetric_coherence,
    stokes_vector,
    coherence_factor,
    mueller_matrix_linear_polarizer,
    mueller_matrix_retarder,
    apply_mueller_chain,
)
from gnostic_engine.api import gnostic_router, gnostic_live_router

SGE_VERSION = "2.0.0"

app = FastAPI(title="Gnostic Engine API", version=SGE_VERSION)

# CORS — allow the control-center frontend (any localhost port) and production origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(gnostic_router)
app.include_router(gnostic_live_router)

# In-memory ring buffer: last 100 verdict results for summary polling
_verdict_history: list[dict] = []
_MAX_HISTORY = 100

# Per-var scanner state to preserve recent observations across requests
_scanner_registry: dict[str, VolumetricScanner] = {}


class Packet(BaseModel):
    var_id: str
    lane_a: float
    lane_b: float
    lane_c: float
    v_mask: list[bool] | None = None
    w_cong: bool | None = None
    w_host_ratio: float | None = None
    w_user_ratio: float | None = None


@app.post("/intake/forage")
async def forage(packet: Packet):
    scanner = _scanner_registry.setdefault(packet.var_id, VolumetricScanner(packet.var_id))
    result = scanner.ingest(packet.lane_a, packet.lane_b)

    s1 = stokes_vector(abs(packet.lane_a), min(abs(packet.lane_b), 1.0), 0.12, 0.08)
    s2 = stokes_vector(abs(packet.lane_b), min(abs(packet.lane_a), 1.0), 0.18, 0.12)
    s3 = stokes_vector(abs(packet.lane_c), min(abs(packet.lane_c), 1.0), 0.25, 0.14)

    result["coherence"] = round(coherence_factor(s1, s2), 4)
    result["resonance"] = round(structural_resonance(s1, s2), 4)
    result["resonance_index"] = round(resonance_index(s1, s2), 4)
    result["volumetric_coherence"] = round(volumetric_coherence([s1, s2, s3]), 4)

    polarizer = mueller_matrix_linear_polarizer(0.25)
    retarder = mueller_matrix_retarder(delta=0.5, theta=0.15)
    result["mueller_chain_energy"] = round(
        float(np.linalg.norm(apply_mueller_chain(s1, polarizer, retarder))), 4
    )

    # Accumulate into history ring
    _verdict_history.append(result)
    if len(_verdict_history) > _MAX_HISTORY:
        _verdict_history.pop(0)

    return result


@app.get("/status/gnosis-summary")
async def gnosis_summary():
    """
    Lightweight poll endpoint — returns aggregate statistics over the last
    N processed packets without requiring a new packet submission.

    Intended consumer: HEPAR GnosticBridgeAdapter health checks.
    """
    if not _verdict_history:
        return {
            "version": SGE_VERSION,
            "packets_processed": 0,
            "verdict_counts": {},
            "avg_structural_read": None,
            "last_verdict": None,
        }

    verdict_counts = Counter(r.get("verdict", "UNKNOWN") for r in _verdict_history)
    reads = [r.get("structural_read", 0.0) for r in _verdict_history if "structural_read" in r]
    avg_sr = round(sum(reads) / len(reads), 4) if reads else None

    return {
        "version": SGE_VERSION,
        "packets_processed": len(_verdict_history),
        "verdict_counts": dict(verdict_counts),
        "avg_structural_read": avg_sr,
        "last_verdict": _verdict_history[-1] if _verdict_history else None,
    }


@app.get("/")
async def root():
    return {"status": "ONLINE", "mode": "Volumetric-4D", "version": SGE_VERSION}