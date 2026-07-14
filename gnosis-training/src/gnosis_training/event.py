"""Gnosis Event wire-shape (Python mirror of @sovereign/gnosis-training-data).

The Gnosis Event is the data contract for one Layer 7 training sample, defined
in ``theo-techno-cosmo/plex/archive/TTCL_v1_0_BREAKDOWN.md:314-359`` (Part 2) and
enforced by the JSON Schema at ``shared/ttcl-specs/gnosis-event.json``. The TS
producer is ``monad-ecosystem/packages/gnosis-training-data/src/event.ts``; this
module is its Python mirror so the trainer can parse the JSONL feedstock into
typed domain objects.

Faithfulness contract: the JSON wire is snake_case (per the spec/schema); the
Python fields here are also snake_case (they already match), so ``from_wire`` /
``to_wire`` are near-identity. ``label`` is ``str | None`` because the Catalan
slot-labels data asset is not yet in the repo (the TS producer emits ``null``;
this mirror never fabricates a Catalan string).

These are FROZEN dataclasses (mirrors the repo's Python domain-type convention —
frozen dataclasses, not pydantic; pydantic only at the HTTP boundary, and there
is no HTTP boundary in this package). No heavy imports; CPU-pure.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


@dataclass(frozen=True)
class WheelState:
    """Per-wheel rotation snapshot."""

    offset: int
    key_hash: str


@dataclass(frozen=True)
class ActiveSlot:
    """One facet's active attribute. ``label`` is null until the Catalan-labels
    data asset lands (never fabricated)."""

    wheel: str
    slot: str
    label: str | None


@dataclass(frozen=True)
class GnosisMessage:
    """A chat message in the training scaffold (system / user / assistant)."""

    role: Literal["system", "user", "assistant"]
    content: str


@dataclass(frozen=True)
class ConstitutionScore:
    """The 5-criterion constitution verdict (maps from @sovereign/ttcl
    ConstitutionResult via the data-gen consumer)."""

    tripartite: float
    logic_compress: float
    source_aligned: float
    epistemic: float
    no_rlhf_signal: float
    total: float
    passes: bool


@dataclass(frozen=True)
class GnosisEvent:
    """One Gnosis training event — the unit the SFT stage trains on.

    The ``assistant`` message content is emitted EMPTY by the data-gen
    producer: it is the SFT training *target*, produced downstream. The
    ``constitution_score`` is the *structural* score of the prompt scaffold, NOT
    a per-response score and NOT the reward model's label (spec line 478 — the
    reward model trains on human-judged preference pairs).
    """

    event_id: str
    constitution_version: str
    wheel_state: dict[str, WheelState]
    active_slots: dict[str, ActiveSlot]  # keys: theology / technology / cosmology
    provenance_tokens: list[str]
    messages: list[GnosisMessage]
    constitution_score: ConstitutionScore


# ── Wire (JSON) ↔ domain conversion ──────────────────────────────────────────
_WHEEL_STATE_KEYS = ("offset", "key_hash")
_SLOT_KEYS = ("wheel", "slot", "label")
_SCORE_KEYS = (
    "tripartite",
    "logic_compress",
    "source_aligned",
    "epistemic",
    "no_rlhf_signal",
    "total",
    "passes",
)


def _wheel_state_from_wire(wire: dict[str, Any]) -> WheelState:
    return WheelState(offset=int(wire["offset"]), key_hash=str(wire["key_hash"]))


def _slot_from_wire(wire: dict[str, Any]) -> ActiveSlot:
    label = wire.get("label")
    return ActiveSlot(
        wheel=str(wire["wheel"]),
        slot=str(wire["slot"]),
        label=str(label) if label is not None else None,
    )


def _message_from_wire(wire: dict[str, Any]) -> GnosisMessage:
    return GnosisMessage(role=str(wire["role"]), content=str(wire["content"]))  # type: ignore[arg-type]


def _score_from_wire(wire: dict[str, Any]) -> ConstitutionScore:
    return ConstitutionScore(
        tripartite=float(wire["tripartite"]),
        logic_compress=float(wire["logic_compress"]),
        source_aligned=float(wire["source_aligned"]),
        epistemic=float(wire["epistemic"]),
        no_rlhf_signal=float(wire["no_rlhf_signal"]),
        total=float(wire["total"]),
        passes=bool(wire["passes"]),
    )


def from_wire(wire: dict[str, Any]) -> GnosisEvent:
    """Parse a raw JSON-line dict (the producer's NDJSON) into a ``GnosisEvent``.

    Raises ``KeyError`` on a missing required key — this is a parser, not a
    validator; call ``validate_event`` (or the JSON Schema) first when the input
    is untrusted. Field names are snake_case per the spec/schema.
    """
    wheel_state = {k: _wheel_state_from_wire(v) for k, v in wire["wheel_state"].items()}
    active_slots = {k: _slot_from_wire(v) for k, v in wire["active_slots"].items()}
    messages = [_message_from_wire(m) for m in wire["messages"]]
    return GnosisEvent(
        event_id=str(wire["event_id"]),
        constitution_version=str(wire["constitution_version"]),
        wheel_state=wheel_state,
        active_slots=active_slots,
        provenance_tokens=[str(t) for t in wire["provenance_tokens"]],
        messages=messages,
        constitution_score=_score_from_wire(wire["constitution_score"]),
    )


def to_wire(event: GnosisEvent) -> dict[str, Any]:
    """Serialize a ``GnosisEvent`` back to the JSON wire shape (round-trips
    ``from_wire``). Stable key order for deterministic output."""
    return {
        "event_id": event.event_id,
        "constitution_version": event.constitution_version,
        "wheel_state": {
            k: {"offset": v.offset, "key_hash": v.key_hash}
            for k, v in event.wheel_state.items()
        },
        "active_slots": {
            k: {"wheel": v.wheel, "slot": v.slot, "label": v.label}
            for k, v in event.active_slots.items()
        },
        "provenance_tokens": list(event.provenance_tokens),
        "messages": [{"role": m.role, "content": m.content} for m in event.messages],
        "constitution_score": {
            "tripartite": event.constitution_score.tripartite,
            "logic_compress": event.constitution_score.logic_compress,
            "source_aligned": event.constitution_score.source_aligned,
            "epistemic": event.constitution_score.epistemic,
            "no_rlhf_signal": event.constitution_score.no_rlhf_signal,
            "total": event.constitution_score.total,
            "passes": event.constitution_score.passes,
        },
    }


def validate_event(event: GnosisEvent) -> list[str]:
    """Return a list of structural problems with ``event`` (empty == valid).

    This is the lightweight CPU-pure structural check the dataset adapter runs
    before the ``passes``-gate. It does NOT replace the JSON Schema
    (``shared/ttcl-specs/gnosis-event.json``) for untrusted input — it is the
    in-process guard the trainer uses once events are already parsed.
    """
    problems: list[str] = []
    if not event.event_id:
        problems.append("event_id is empty")
    if not event.wheel_state:
        problems.append("wheel_state is empty")
    for domain in ("theology", "technology", "cosmology"):
        if domain not in event.active_slots:
            problems.append(f"active_slots missing domain {domain!r}")
    if len(event.messages) != 3:
        problems.append(f"expected 3 messages (system/user/assistant), got {len(event.messages)}")
    else:
        roles = tuple(m.role for m in event.messages)
        if roles != ("system", "user", "assistant"):
            problems.append(f"expected roles (system, user, assistant), got {roles}")
    score = event.constitution_score
    for name in _SCORE_KEYS:
        value = getattr(score, name)
        if name != "passes" and not isinstance(value, bool):
            if not (0.0 <= float(value) <= 1.0):
                problems.append(f"constitution_score.{name} out of [0,1]: {value}")
    return problems