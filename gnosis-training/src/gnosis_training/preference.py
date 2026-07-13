"""Preference-pair builder — the spec's biggest silence, concretized.

The spec (``TTCL_v1_0_BREAKDOWN.md:297-300``) says the reward model trains on
"preference pairs (response A vs response B)" but each Gnosis event has ONE
``assistant`` response (the data-gen producer emits it EMPTY — it is the SFT
training target). The reference guide
(``theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py`) makes the
gap explicit: a HUMAN "read[s] both responses and mark[s] which one is better
(chosen vs rejected)", 200–300 pairs minimum, 8 categories, the exact JSONL
schema below.

HONEST CONCRETIZATION (load-bearing — do NOT regress):

- The reward model trains on **HUMAN-judged** preference pairs (spec line 478),
  NOT on the auto-generated scaffold. ``load_human_pairs(path)`` ingests a
  human-authored ``preference_pairs_ALL.jsonl`` in the reference schema and
  validates it — this is the path the reward model actually trains on.
- ``build_bootstrap_worksheet(events, ...)`` emits a **bootstrap worksheet** —
  pairs in the reference's exact schema, marked ``bootstrap: true``, with EMPTY
  ``chosen.response`` / ``rejected.response`` (a human fills them in) and the
  rubric ``scores`` pre-filled from the event's ``constitution_score``. It is a
  WORKSHEET, not ground truth: a human opens the file, writes / flips the
  responses, and saves — upgrading a scaffold pair into a human-judged pair
  without reformatting.
- ``constitution_score`` is NOT the reward model's label and NOT a PPO reward.
  It seeds the worksheet's rubric scores (to be confirmed/edited by humans) and
  gates SFT inclusion via ``passes`` (see ``dataset.py``).

CPU-pure — no torch.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

from .event import GnosisEvent
from .generated.hyperparams import (
    APEIRON_SCORE_MAX,
    APEIRON_SCORE_MIN,
    CONSTITUTION_PASS_TOTAL,
    PREFERENCE_CATEGORY_COUNTS,
    PREFERENCE_CHOSEN_MIN_CRITERIA_PASSING,
    PREFERENCE_CRITERION_PASS_THRESHOLD,
    PREFERENCE_MIN_SCORE_GAP,
)
from .metrics import deterministic_shuffle


@dataclass(frozen=True)
class PreferenceScores:
    """The 5-criterion + total scores on one response (reference schema)."""

    tripartite: float
    logic_compress: float
    source_aligned: float
    epistemic: float
    no_rlhf_signal: float
    total: float


@dataclass(frozen=True)
class PreferenceResponse:
    """One side of a preference pair (chosen or rejected)."""

    response: str
    scores: PreferenceScores
    notes: str


@dataclass(frozen=True)
class PreferencePair:
    """One preference pair in the reference's exact JSON schema
    (``preference_pair_generator_reference.py``). ``bootstrap=True`` marks a
    scaffold pair (empty responses, rubric pre-filled) that needs human authoring
    before it is trainable."""

    pair_id: str
    category: str
    prompt: str
    chosen: PreferenceResponse
    rejected: PreferenceResponse
    failing_criteria: list[str]
    apeiron: bool
    bootstrap: bool
    constitution_version: str


# ── Wire (JSON) ↔ domain ─────────────────────────────────────────────────────
def _scores_from_wire(wire: dict[str, Any]) -> PreferenceScores:
    return PreferenceScores(
        tripartite=float(wire["tripartite"]),
        logic_compress=float(wire["logic_compress"]),
        source_aligned=float(wire["source_aligned"]),
        epistemic=float(wire["epistemic"]),
        no_rlhf_signal=float(wire["no_rlhf_signal"]),
        total=float(wire["total"]),
    )


def _response_from_wire(wire: dict[str, Any]) -> PreferenceResponse:
    return PreferenceResponse(
        response=str(wire.get("response", "")),
        scores=_scores_from_wire(wire["scores"]),
        notes=str(wire.get("notes", "")),
    )


def pair_from_wire(wire: dict[str, Any]) -> PreferencePair:
    """Parse a JSON-line dict (reference schema) into a ``PreferencePair``."""
    return PreferencePair(
        pair_id=str(wire["pair_id"]),
        category=str(wire["category"]),
        prompt=str(wire["prompt"]),
        chosen=_response_from_wire(wire["chosen"]),
        rejected=_response_from_wire(wire["rejected"]),
        failing_criteria=[str(c) for c in wire.get("failing_criteria", [])],
        apeiron=bool(wire.get("apeiron", False)),
        bootstrap=bool(wire.get("bootstrap", False)),
        constitution_version=str(wire.get("constitution_version", "v2.0")),
    )


def pair_to_wire(pair: PreferencePair) -> dict[str, Any]:
    """Serialize a ``PreferencePair`` to the reference JSON schema (stable key
    order, round-trips ``pair_from_wire``)."""

    def _resp(r: PreferenceResponse) -> dict[str, Any]:
        return {
            "response": r.response,
            "scores": {
                "tripartite": r.scores.tripartite,
                "logic_compress": r.scores.logic_compress,
                "source_aligned": r.scores.source_aligned,
                "epistemic": r.scores.epistemic,
                "no_rlhf_signal": r.scores.no_rlhf_signal,
                "total": r.scores.total,
            },
            "notes": r.notes,
        }

    return {
        "pair_id": pair.pair_id,
        "category": pair.category,
        "prompt": pair.prompt,
        "chosen": _resp(pair.chosen),
        "rejected": _resp(pair.rejected),
        "failing_criteria": list(pair.failing_criteria),
        "apeiron": pair.apeiron,
        "bootstrap": pair.bootstrap,
        "constitution_version": pair.constitution_version,
    }


# ── Source 3: load + validate HUMAN-judged pairs (the trainable path) ────────
def _criteria_passing_count(scores: PreferenceScores) -> int:
    return sum(
        1
        for v in (
            scores.tripartite,
            scores.logic_compress,
            scores.source_aligned,
            scores.epistemic,
            scores.no_rlhf_signal,
        )
        if v >= PREFERENCE_CRITERION_PASS_THRESHOLD
    )


def validate_pair(pair: PreferencePair) -> list[str]:
    """Validate a pair against the reference's quality-control rules (RULES 1,
    2, 6). Returns a list of problems (empty == valid). The reward model trains
    only on valid pairs (garbage-in-garbage-out, spec line 476)."""
    problems: list[str] = []
    gap = pair.chosen.scores.total - pair.rejected.scores.total
    if gap < PREFERENCE_MIN_SCORE_GAP:
        problems.append(
            f"score gap {gap:.3f} < {PREFERENCE_MIN_SCORE_GAP} (RULE 1: too ambiguous)"
        )
    if _criteria_passing_count(pair.chosen.scores) < PREFERENCE_CHOSEN_MIN_CRITERIA_PASSING:
        problems.append(
            "chosen passes < 4 of 5 criteria at 0.70 (RULE 2)"
        )
    if pair.apeiron:
        for label, resp in (("chosen", pair.chosen), ("rejected", pair.rejected)):
            t = resp.scores.total
            if not (APEIRON_SCORE_MIN <= t <= APEIRON_SCORE_MAX):
                problems.append(
                    f"apeiron {label}.total {t:.3f} outside [{APEIRON_SCORE_MIN},"
                    f"{APEIRON_SCORE_MAX}] (RULE 6)"
                )
    if pair.bootstrap:
        problems.append(
            "bootstrap worksheet pair (empty responses) is NOT trainable — "
            "human authoring required before RM training (spec line 478)"
        )
    return problems


def load_human_pairs(path: str | Path) -> list[PreferencePair]:
    """Load a human-authored ``preference_pairs_ALL.jsonl`` (reference schema)
    and return ONLY the valid, non-bootstrap pairs. Invalid pairs raise with a
    precise message (garbage-in-garbage-out)."""
    p = Path(path)
    pairs: list[PreferencePair] = []
    with p.open("r", encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, start=1):
            line = line.strip()
            if not line:
                continue
            wire = json.loads(line)
            pair = pair_from_wire(wire)
            problems = validate_pair(pair)
            if problems:
                raise ValueError(f"{p}:{lineno} pair {pair.pair_id}: {problems}")
            pairs.append(pair)
    return pairs


# ── Source 1: bootstrap worksheet (scaffold — NOT trainable without humans) ─
def _event_to_scores(event: GnosisEvent) -> PreferenceScores:
    s = event.constitution_score
    return PreferenceScores(
        tripartite=s.tripartite,
        logic_compress=s.logic_compress,
        source_aligned=s.source_aligned,
        epistemic=s.epistemic,
        no_rlhf_signal=s.no_rlhf_signal,
        total=s.total,
    )


def _user_prompt(event: GnosisEvent) -> str:
    """The user message is the prompt posed to the model (spec line 337)."""
    for m in event.messages:
        if m.role == "user":
            return m.content
    return ""


def _category_for_index(index: int) -> str:
    """Round-robin assignment to the reference category distribution. The
    worksheet does not know which failure mode a (future, human-authored)
    response will illustrate, so it just spreads pairs across categories so the
    human authoring pass hits the target distribution with minimal reshuffling.
    """
    cats = list(PREFERENCE_CATEGORY_COUNTS.keys())
    return cats[index % len(cats)]


def build_bootstrap_worksheet(
    events: list[GnosisEvent],
    seed: int = 42,
) -> list[PreferencePair]:
    """Build a bootstrap WORKSHEET from gnosis events (Source 1).

    The gnosis feedstock has empty ``assistant`` content (it is the SFT target),
    so this builder CANNOT invent responses. It emits pairs with empty
    ``chosen.response`` / ``rejected.response``, the rubric ``scores`` pre-filled
    from the event's ``constitution_score`` (chosen) and a degraded copy
    (rejected, one criterion dropped), marked ``bootstrap: True``. A human fills
    the responses and saves — the schema already matches ``load_human_pairs``.

    This is a WORKSHEET, not a trainable dataset. The reward model trains on
    human-judged pairs (spec line 478), not this scaffold.
    """
    if not events:
        return []

    events = deterministic_shuffle(events, seed)
    pairs: list[PreferencePair] = []
    for idx, event in enumerate(events):
        chosen_scores = _event_to_scores(event)
        # Degraded rejected: drop the lowest-scoring criterion to 0.30 and
        # recompute total as the mean of the 5 (a coarse below-chosen signal so
        # the worksheet's gap is visible before humans author real responses).
        criterion_values = [
            ("C1", chosen_scores.tripartite),
            ("C2", chosen_scores.logic_compress),
            ("C3", chosen_scores.source_aligned),
            ("C4", chosen_scores.epistemic),
            ("C5", chosen_scores.no_rlhf_signal),
        ]
        failing = min(criterion_values, key=lambda c: c[1])
        rejected_vals = {
            "tripartite": chosen_scores.tripartite,
            "logic_compress": chosen_scores.logic_compress,
            "source_aligned": chosen_scores.source_aligned,
            "epistemic": chosen_scores.epistemic,
            "no_rlhf_signal": chosen_scores.no_rlhf_signal,
        }
        rejected_vals[_criterion_field(failing[0])] = 0.30
        rejected_total = sum(rejected_vals.values()) / 5.0
        rejected_scores = PreferenceScores(
            tripartite=rejected_vals["tripartite"],
            logic_compress=rejected_vals["logic_compress"],
            source_aligned=rejected_vals["source_aligned"],
            epistemic=rejected_vals["epistemic"],
            no_rlhf_signal=rejected_vals["no_rlhf_signal"],
            total=rejected_total,
        )
        apeiron = chosen_scores.total < CONSTITUTION_PASS_TOTAL
        pairs.append(
            PreferencePair(
                pair_id=f"BOOT-{idx + 1:04d}",
                category=_category_for_index(idx),
                prompt=_user_prompt(event),
                chosen=PreferenceResponse(
                    response="",  # human authors
                    scores=chosen_scores,
                    notes="bootstrap: pre-filled from constitution_score — confirm/flip",
                ),
                rejected=PreferenceResponse(
                    response="",  # human authors
                    scores=rejected_scores,
                    notes=f"bootstrap: degraded {failing[0]} to 0.30 — confirm/flip",
                ),
                failing_criteria=[failing[0]],
                apeiron=apeiron,
                bootstrap=True,
                constitution_version=event.constitution_version,
            )
        )
    return pairs


def _criterion_field(code: str) -> str:
    return {
        "C1": "tripartite",
        "C2": "logic_compress",
        "C3": "source_aligned",
        "C4": "epistemic",
        "C5": "no_rlhf_signal",
    }[code]


def serialize_pairs_jsonl(pairs: list[PreferencePair]) -> str:
    """NDJSON (one stable-keyed JSON object per line). Deterministic output
    (no wall-clock / random) — mirrors the repo's byte-reproducibility gate."""
    lines = [json.dumps(pair_to_wire(p), sort_keys=False) for p in pairs]
    return "\n".join(lines) + ("\n" if lines else "")


def export_pairs_for_review(pairs: list[PreferencePair], path: str | Path) -> None:
    """Write a bootstrap worksheet (or any pair list) to JSONL for human
    authoring / review. Convenience helper for the Source-1 worksheet flow —
    NOT a training path. CPU-pure (no heavy deps)."""
    with Path(path).open("w", encoding="utf-8") as fh:
        for p in pairs:
            fh.write(json.dumps(pair_to_wire(p)) + "\n")


def iter_pairs_jsonl(path: str | Path) -> Iterator[PreferencePair]:
    """Stream pairs from a JSONL (reference schema) without loading all into
    memory. Used by the reward dataset adapter for large human-authored sets."""
    with Path(path).open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                yield pair_from_wire(json.loads(line))