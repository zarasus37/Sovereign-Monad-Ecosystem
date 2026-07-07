"""
FastAPI routes for the Gnostic Engine.

Exposes two categories of endpoints:

1. Computation endpoints (existing):
   POST /gnostic/scan           — volumetric scan (single packet)
   POST /gnostic/resonance      — structural resonance between two vectors
   POST /gnostic/coherence      — volumetric coherence across N vectors
   POST /gnostic/mueller-resonance — Mueller matrix resonance score

2. Live state endpoints (Phase C integration):
   GET  /api/v1/health          — liveness probe; returns version, uptime, engine state
   GET  /api/v1/gnosis/latest   — latest N GnosisScore results (JSON)
   GET  /api/v1/gnosis/stream   — Server-Sent Events stream of live GnosisScores
   GET  /api/v1/dove/signals    — latest N DoveSignal records (JSON)
   GET  /api/v1/dove/active     — all currently unresolved DoveSignals
   POST /api/v1/gnosis/process  — process a full GnosticEngine packet and record score

All live endpoint responses conform to the @sovereign/types TypeScript interfaces
so the control-center frontend can consume them directly.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional

from ..core.volumetric_scanner import VolumetricScanner
from ..core.gnostic_engine import GnosticEngine
from ..utils.math import (
    structural_resonance,
    coherence_factor,
    resonance_index,
    volumetric_coherence,
    mueller_resonance_score,
)
from .live_state import (
    engine_state,
    GnosisScore,
    StokesCoherence,
    PulfrichParallaxResult,
    DoveSignalRecord,
)
from ..persistence.replay import replay as build_replay_result
from ..generated.numerics import (
    FOCAL_LOCK_THRESHOLD,
    BOUNDARY_THRESHOLD,
    MAX_BLINKS,
)
import numpy as np

# ── Routers ───────────────────────────────────────────────────────────────────

# Legacy computation router — kept for backward compat
router = APIRouter(prefix="/gnostic", tags=["gnostic"])

# Live state router — Phase C integration surface
live_router = APIRouter(prefix="/api/v1", tags=["live-state"])

# Shared engine instance for live packet processing.
# Defaults come from the canonical numerics module (Layer 4a).
_engine = GnosticEngine(threshold=FOCAL_LOCK_THRESHOLD, max_blinks=MAX_BLINKS)

# ── Legacy computation models ─────────────────────────────────────────────────


class ScanRequest(BaseModel):
    var_id: str
    value: float
    secondary_value: Optional[float] = None


class ResonanceRequest(BaseModel):
    s1: list[float]
    s2: list[float]


class CoherenceRequest(BaseModel):
    vectors: list[list[float]]


class MuellerRequest(BaseModel):
    s1: list[float]
    s2: list[float]


# ── Legacy computation endpoints ──────────────────────────────────────────────


@router.post("/scan", summary="Volumetric scan — single Data-PBFP packet")
def volumetric_scan(req: ScanRequest) -> dict[str, Any]:
    scanner = VolumetricScanner(req.var_id)
    result = scanner.ingest(req.value, req.secondary_value)
    return result


@router.post("/resonance", summary="Structural resonance between two Stokes vectors")
def compute_resonance(req: ResonanceRequest) -> dict[str, Any]:
    s1 = np.array(req.s1)
    s2 = np.array(req.s2)
    score = structural_resonance(s1, s2)
    index = resonance_index(s1, s2)
    return {
        "resonance": round(score, 4),
        "resonance_index": round(index, 4),
        "coherence": round(coherence_factor(s1, s2), 4),
    }


@router.post("/coherence", summary="Volumetric coherence across N vectors")
def compute_volumetric_coherence(req: CoherenceRequest) -> dict[str, Any]:
    vectors = [np.array(vector) for vector in req.vectors]
    score = volumetric_coherence(vectors)
    return {"volumetric_coherence": round(score, 4)}


@router.post("/mueller-resonance", summary="Mueller matrix resonance score")
def compute_mueller_resonance(req: MuellerRequest) -> dict[str, Any]:
    s1 = np.array(req.s1)
    s2 = np.array(req.s2)
    score = mueller_resonance_score(s1, s2)
    return {"mueller_resonance_score": round(score, 4)}


# ── Live state models ─────────────────────────────────────────────────────────


class GnosticPacketRequest(BaseModel):
    """Full Data-PBFP packet for the GnosticEngine.process_packet() pathway."""

    agent_id: str = Field(..., description="Agent or variable identifier")
    lane_a: float = Field(..., description="Depth intensity (0.0–1.0)")
    lane_b: float = Field(..., description="Truth intensity (0.0–1.0)")
    lane_c: float = Field(..., description="Width/Spin intensity (0.0–1.0)")
    v_mask: list[bool] = Field(
        default_factory=list,
        description="Bedrock V-mask bits [AUTH_CHAIN, PROV_ORIGIN, HIST_STABLE, ...]",
    )
    w_cong: bool = Field(default=True, description="Contagion bit — True = isolated")
    w_host_ratio: Optional[float] = Field(None, description="Fraction of infra affected (0–1)")
    w_user_ratio: Optional[float] = Field(None, description="Fraction of users affected (0–1)")
    trace: Optional[dict[str, Any]] = Field(
        None,
        description=(
            "CHARTER §4 intention trace. Optional on the request; propagated to "
            "the resulting GnosisScore and any emitted Dove signals so the full "
            "decision chain is reconstructable via GET /api/v1/audit/replay."
        ),
    )


# ── Health endpoint ───────────────────────────────────────────────────────────


@live_router.get("/health", summary="Liveness probe — engine version and session state")
def health() -> dict[str, Any]:
    """
    Returns the current engine health snapshot.

    Response is aligned to the control-center health panel expectations:
    - status: 'healthy' | 'degraded' | 'error'
    - version: MOF version string
    - uptime_seconds: seconds since this process started
    - sequence_counter: monotonic event count
    """
    return engine_state.health_snapshot()


# ── GnosisScore endpoints ─────────────────────────────────────────────────────


@live_router.post(
    "/gnosis/process",
    summary="Process a GnosticEngine packet and record the resulting GnosisScore",
)
def process_packet(req: GnosticPacketRequest) -> dict[str, Any]:
    """
    Runs the GnosticEngine.process_packet() pipeline on the submitted data,
    constructs a fully typed GnosisScore, records it in the session state,
    and returns the result.

    This is the primary ingestion endpoint — organs and agents call this
    to register behavioral observations with the engine.
    """
    window_start = datetime.now(timezone.utc).isoformat()

    packet_data: dict[str, Any] = {
        "lane_a": req.lane_a,
        "lane_b": req.lane_b,
        "lane_c": req.lane_c,
        "v_mask": req.v_mask,
        "w_cong": req.w_cong,
        "w_host_ratio": req.w_host_ratio,
        "w_user_ratio": req.w_user_ratio,
    }

    raw = _engine.process_packet(req.agent_id, packet_data)
    window_end = datetime.now(timezone.utc).isoformat()

    # Derive Stokes coherence from engine internals
    sr: float = raw.get("structural_read", 0.0)
    tilt: float = raw.get("phase_tilt", 0.0)
    verdict: str = raw.get("verdict", "UNCLASSIFIED")

    # Map verdict to doctrine state
    doctrine_map: dict[str, str] = {
        "FOCAL_LOCK": "SELF_NAVIGATING",
        "BLINK": "ADJACENT_CONVERGENT",
        "QUARANTINE": "PATTERN_FOLLOWING",
        "MAGNITUDE_REJECT": "PATTERN_FOLLOWING",
    }
    doctrine_state = doctrine_map.get(verdict, "SELF_NAVIGATING")

    # Map structural read to lane (boundaries from canonical numerics — Layer 4a)
    if sr >= FOCAL_LOCK_THRESHOLD:
        lane = "LANE_A"
    elif sr >= BOUNDARY_THRESHOLD:
        lane = "LANE_B"
    else:
        lane = "LANE_C"

    blink_threshold = FOCAL_LOCK_THRESHOLD
    blink_triggered = sr < blink_threshold

    coherence = StokesCoherence(
        depth=round(req.lane_a, 4),
        truth=round(req.lane_b, 4),
        width=round(req.lane_c, 4),
    )
    parallax = PulfrichParallaxResult(
        tilt_magnitude=round(abs(tilt), 4),
        tilt_threshold=blink_threshold,
        blink_triggered=blink_triggered,
    )

    seq = engine_state.next_sequence()
    score = GnosisScore(
        agent_id=req.agent_id,
        window_start=window_start,
        window_end=window_end,
        coherence=coherence,
        overall_score=round(sr, 4),
        parallax=parallax,
        doctrine_state=doctrine_state,
        lane=lane,
        quarantine_triggered=(verdict == "QUARANTINE"),
        observation_count=len(_engine.history.get(req.agent_id, [])),
        sequence_number=seq,
        verdict=verdict,
        trace=req.trace,
    )

    score_event = engine_state.record_score(score)

    # Check for Dove signal conditions (inherits the score's trace so the
    # quarantine/blink chain reconstructs as one intention chain; the dove's
    # trace.parentEventId links it to the score event for chain reconstruction).
    _maybe_emit_dove_signal(score, score_event.event_id)

    return score.to_dict()


@live_router.get(
    "/gnosis/latest",
    summary="Latest N GnosisScore results across all agents",
)
def latest_scores(limit: int = Query(default=10, ge=1, le=100)) -> dict[str, Any]:
    """
    Returns the most recent N GnosisScore results, newest first.
    Consumed by the control-center dashboard's gnosis panel.
    """
    return {
        "scores": engine_state.latest_scores(limit=limit),
        "count": min(limit, engine_state.sequence_counter),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@live_router.get(
    "/gnosis/stream",
    summary="Server-Sent Events stream of live GnosisScores",
    response_class=StreamingResponse,
)
async def gnosis_stream() -> StreamingResponse:
    """
    SSE stream of GnosisScore events.

    The control-center frontend connects to this endpoint via EventSource.
    Each event is a JSON-encoded GnosisScore dict.

    The stream emits:
    - A heartbeat every 5 seconds (comment line) to keep the connection alive.
    - A `gnosis_score` event whenever a new score is recorded.

    Note: This implementation polls the session state buffer. In a fully
    async implementation, the engine_state would have an asyncio.Queue
    that callers push to directly.
    """
    return StreamingResponse(
        _gnosis_sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


async def _gnosis_sse_generator() -> AsyncGenerator[str, None]:
    """Generator for the gnosis SSE stream."""
    last_seq = engine_state.sequence_counter
    heartbeat_interval = 5.0  # seconds

    while True:
        await asyncio.sleep(0.5)

        current_seq = engine_state.sequence_counter
        if current_seq > last_seq:
            # New scores available — emit all new ones
            scores = engine_state.latest_scores(limit=current_seq - last_seq)
            for score in reversed(scores):
                payload = json.dumps(score)
                yield f"event: gnosis_score\ndata: {payload}\n\n"
            last_seq = current_seq
        else:
            # Heartbeat
            yield f": heartbeat {int(time.time())}\n\n"

        await asyncio.sleep(heartbeat_interval - 0.5)


# ── Hepar audit result endpoints ─────────────────────────────────────────────


class HeparAuditSubmission(BaseModel):
    """
    Payload shape for Hepar audit results pushed from the sovereign-bus
    into the gnostic-engine relay buffer.

    This allows the control-center to query Hepar state through a single
    origin (the gnostic-engine) rather than connecting to the organ directly.
    """

    audit_id: str
    contract_address: str
    chain_id: int
    tier: str
    status: str
    aggregate_risk: float
    adversarial_risk: float
    critical_findings_count: int
    stages: list[dict[str, Any]] = Field(default_factory=list)
    started_at: str
    completed_at: Optional[str] = None
    gnosis_verdict: Optional[str] = None
    gnosis_structural_read: Optional[float] = None
    trace: Optional[dict[str, Any]] = Field(
        None,
        description="CHARTER §4 intention trace (hepar.audit.completed is trace-required).",
    )


# In-process Hepar audit relay buffer — holds last 50 audit results
_hepar_results: list[dict[str, Any]] = []
_MAX_HEPAR = 50


@live_router.post(
    "/hepar/submit",
    summary="Submit a Hepar audit result from the sovereign-bus relay",
    status_code=201,
)
def hepar_submit(submission: HeparAuditSubmission) -> dict[str, Any]:
    """
    Called by the sovereign-bus Hepar bridge when a HeparAuditResult event
    is emitted. Stores the result in a session ring buffer so the dashboard
    can poll /api/v1/hepar/latest without connecting to the organ directly.
    """
    record = submission.model_dump()
    record["received_at"] = datetime.now(timezone.utc).isoformat()

    _hepar_results.append(record)
    if len(_hepar_results) > _MAX_HEPAR:
        _hepar_results.pop(0)

    # Persist to the durable event log (hepar.audit.completed is trace-required).
    engine_state._append_event(
        event_type="hepar.audit.completed",
        timestamp=record["received_at"],
        sequence_number=engine_state.next_sequence(),
        payload={k: v for k, v in record.items() if k != "trace"},
        trace=submission.trace,
    )

    return {"recorded": True, "audit_id": submission.audit_id}


@live_router.get("/hepar/latest", summary="Latest N Hepar audit results (newest first)")
def hepar_latest(limit: int = Query(default=10, ge=1, le=50)) -> dict[str, Any]:
    """
    Returns the most recent N Hepar audit results relayed from the organ.
    Consumed by the control-center Hepar panel.

    Returns an empty list when no audits have been submitted yet —
    the frontend renders a 'No audits yet' state in this case.
    """
    results = list(reversed(_hepar_results))[:limit]
    return {
        "audits": results,
        "count": len(results),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Dove signal endpoints ─────────────────────────────────────────────────────


@live_router.get("/dove/signals", summary="Latest N Dove signals (newest first)")
def dove_signals(limit: int = Query(default=20, ge=1, le=50)) -> dict[str, Any]:
    """
    Returns the most recent N Dove signals.
    Consumed by the control-center Dove monitor panel.
    """
    return {
        "signals": engine_state.latest_dove_signals(limit=limit),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@live_router.get("/dove/active", summary="All currently unresolved Dove signals")
def dove_active() -> dict[str, Any]:
    """
    Returns all active (unresolved) Dove signals.
    Active signals indicate ongoing drift conditions.
    """
    active = engine_state.active_dove_signals()
    return {
        "active_signals": active,
        "count": len(active),
        "alignment_state": _compute_alignment_state(active),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Internal helpers ──────────────────────────────────────────────────────────


def _compute_alignment_state(active_signals: list[dict[str, Any]]) -> str:
    """Derive alignment state from active signal tiers."""
    if not active_signals:
        return "aligned"
    tiers = {s["tier"] for s in active_signals}
    if 3 in tiers:
        return "emergency"
    if 2 in tiers:
        return "governance-required"
    return "monitoring"


def _maybe_emit_dove_signal(score: GnosisScore, parent_event_id: str | None) -> None:
    """
    Check the GnosisScore for drift conditions and emit Dove signals
    to the session state if thresholds are crossed.

    Tier 1: overall_score < BOUNDARY_THRESHOLD (adjacent-convergent zone)
    Tier 2: quarantine_triggered (pattern-following + kill-switch)

    The signal inherits the score's CHARTER §4 trace and links back to the score
    event via `trace.parentEventId`, so the score→dove chain reconstructs as one
    linked intention chain in the durable event log.
    """
    now = datetime.now(timezone.utc).isoformat()
    trace = _with_parent(score.trace, parent_event_id)

    if score.quarantine_triggered:
        signal = DoveSignalRecord(
            signal_id=str(uuid.uuid4()),
            timestamp=now,
            tier=2,
            layer="gnosis",
            drift_category="agent.hollow.convergence",
            observed_value=str(score.overall_score),
            threshold=str(FOCAL_LOCK_THRESHOLD),
            description=(
                f"Agent '{score.agent_id}' triggered quarantine after "
                f"{_engine.max_blinks} consecutive blinks. "
                f"Structural read: {score.overall_score}. "
                "Possible hollow convergence under stress."
            ),
            governance_proposal_generated=True,
            resolved=False,
            trace=trace,
        )
        engine_state.record_dove_signal(signal)

    elif score.overall_score < BOUNDARY_THRESHOLD:
        signal = DoveSignalRecord(
            signal_id=str(uuid.uuid4()),
            timestamp=now,
            tier=1,
            layer="gnosis",
            drift_category="agent.hollow.convergence",
            observed_value=str(score.overall_score),
            threshold=str(BOUNDARY_THRESHOLD),
            description=(
                f"Agent '{score.agent_id}' structural read ({score.overall_score}) "
                f"is below adjacent-convergent threshold ({BOUNDARY_THRESHOLD}). "
                "Monitoring for sustained drift."
            ),
            governance_proposal_generated=False,
            resolved=False,
            trace=trace,
        )
        engine_state.record_dove_signal(signal)


def _with_parent(
    trace: dict[str, Any] | None, parent_event_id: str | None
) -> dict[str, Any] | None:
    """Return a copy of `trace` with `parentEventId` set, or None if trace is None."""
    if trace is None:
        return None
    linked = dict(trace)
    if parent_event_id is not None:
        linked["parentEventId"] = parent_event_id
    return linked


# ── Audit / replay endpoint (Layer 5) ──────────────────────────────────────────


@live_router.get(
    "/audit/replay",
    summary="Reconstruct the CHARTER §4 intention chain from the durable event log",
)
def audit_replay(
    from_ts: Optional[str] = Query(
        default=None,
        alias="from",
        description="ISO-8601 lower bound (inclusive). Defaults to the start of the log.",
    ),
    to_ts: Optional[str] = Query(
        default=None,
        alias="to",
        description="ISO-8601 upper bound (inclusive). Defaults to the end of the log.",
    ),
) -> dict[str, Any]:
    """
    Returns the durable event log contents in the queried time window plus the
    reconstructed intention chains (constraint envelope → inbound signals → gnosis
    evaluation → narrative purpose → chosen action), threaded via
    `trace.parentEventId` links.

    The durable JSONL log is the source of truth; the in-memory ring buffers are a
    read shortcut. Events without a trace appear in the flat `events` list but do
    not participate in chain reconstruction (they are ambient telemetry).
    """
    return build_replay_result(engine_state.event_log, from_ts, to_ts)
