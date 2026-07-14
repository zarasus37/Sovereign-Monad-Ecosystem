"""DRY-RUN ONLY — synthetic preference pairs to exercise the reward trainer.

This module exists for ONE purpose: the dry run (``docs/gnosis-training/
DRY_RUN_RUNBOOK.md``) must run Stage 2 (Reward) end-to-end, and the reward
trainer (``reward.build_reward_trainer`` → ``preference.load_human_pairs``)
trains ONLY on valid, non-bootstrap preference pairs. The real reward model
trains on **HUMAN-judged** pairs (spec line 478) — which do not exist yet
(a human authoring job). The bootstrap worksheet (``preference.build_bootstrap_worksheet``)
emits ``bootstrap=True`` pairs with EMPTY responses, which
``preference.validate_pair`` deliberately rejects as non-trainable.

So the dry run cannot use the worksheet. Instead this builder synthesizes a
small set of ``bootstrap=False`` pairs with short canned responses + synthetic
scores that PASS ``validate_pair`` (gap >= ``PREFERENCE_MIN_SCORE_GAP``,
chosen passes >= 4/5 criteria at threshold). The pairs are clearly marked
``dry_run`` in the ``notes`` field.

HONESTY POSTURE (load-bearing — do NOT regress):

- These are **NOT human judgments** and **NOT ground truth**. They exist only
  so the reward *trainer executes* (real gradients flow through
  ``AutoModelForSequenceClassification`` under 4-bit QLoRA). The dry run proves
  the pipeline runs end-to-end; it does NOT prove the model learns the
  constitution.
- The real reward model still trains on human-judged pairs via
  ``load_human_pairs``. This builder is never on that path.
- The prompt is the event's real user message; the responses + scores are
  synthetic stand-ins. ``apeiron=False`` so the apeiron band check (RULE 6)
  does not apply.

CPU-pure — no torch, no transformers. Mirrors ``preference.py``'s patterns +
reuses its ``PreferencePair`` / ``PreferenceResponse`` / ``PreferenceScores``
domain types + ``pair_to_wire`` / ``serialize_pairs_jsonl`` /
``export_pairs_for_review`` helpers (stable schema, deterministic output).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .event import GnosisEvent
from .generated.hyperparams import PREFERENCE_CATEGORY_COUNTS
from .metrics import deterministic_shuffle
from .preference import (
    PreferencePair,
    PreferenceResponse,
    PreferenceScores,
    export_pairs_for_review,
    pair_to_wire,
    serialize_pairs_jsonl,
    validate_pair,
)


# Synthetic scores — chosen passes all 5 criteria at 0.80 (>= 0.70 threshold);
# rejected fails all at 0.30. Gap = 0.50 >> PREFERENCE_MIN_SCORE_GAP (0.15).
# These are STAND-IN labels, not measured qualities.
_CHOSEN_CRITERION = 0.80
_REJECTED_CRITERION = 0.30
_CHOSEN_TOTAL = _CHOSEN_CRITERION  # mean of 5 equal values
_REJECTED_TOTAL = _REJECTED_CRITERION

# Short canned responses — non-empty so the reward dataset row shape
# ({prompt, chosen, rejected}) is real text the tokenizer can encode.
_CHOSEN_RESPONSE = (
    "dry-run chosen stand-in: a tripartite, logic-visible, source-aligned response."
)
_REJECTED_RESPONSE = (
    "dry-run rejected stand-in: a single-domain, conclusion-only, moralizing response."
)


def _chosen_scores() -> PreferenceScores:
    return PreferenceScores(
        tripartite=_CHOSEN_CRITERION,
        logic_compress=_CHOSEN_CRITERION,
        source_aligned=_CHOSEN_CRITERION,
        epistemic=_CHOSEN_CRITERION,
        no_rlhf_signal=_CHOSEN_CRITERION,
        total=_CHOSEN_TOTAL,
    )


def _rejected_scores() -> PreferenceScores:
    return PreferenceScores(
        tripartite=_REJECTED_CRITERION,
        logic_compress=_REJECTED_CRITERION,
        source_aligned=_REJECTED_CRITERION,
        epistemic=_REJECTED_CRITERION,
        no_rlhf_signal=_REJECTED_CRITERION,
        total=_REJECTED_TOTAL,
    )


def _user_prompt(event: GnosisEvent) -> str:
    """The event's real user message — the pair's prompt (mirrors preference.py)."""
    for m in event.messages:
        if m.role == "user":
            return m.content
    return ""


def _category_for_index(index: int) -> str:
    """Round-robin across the reference categories (mirrors preference.py)."""
    cats = list(PREFERENCE_CATEGORY_COUNTS.keys())
    return cats[index % len(cats)]


def build_dry_run_pairs(events: list[GnosisEvent], seed: int = 42) -> list[PreferencePair]:
    """Build dry-run synthetic preference pairs from gnosis events.

    One pair per event (the event supplies the real user prompt); responses +
    scores are synthetic stand-ins. Every pair is ``bootstrap=False``,
    ``apeiron=False``, has non-empty responses, and PASSES ``validate_pair`` —
    so ``preference.load_human_pairs`` will accept them when the dry-run
    reward stage loads the JSONL this builder serializes.

    Deterministic (seeded ``deterministic_shuffle`` — no wall-clock / random),
    mirroring the repo's byte-reproducibility discipline. Returns ``[]`` if
    ``events`` is empty (the caller raises a clear error if no pairs result).
    """
    if not events:
        return []

    events = deterministic_shuffle(events, seed)
    pairs: list[PreferencePair] = []
    for idx, event in enumerate(events):
        chosen = PreferenceResponse(
            response=_CHOSEN_RESPONSE,
            scores=_chosen_scores(),
            notes="dry-run: SYNTHETIC label — not a human judgment (spec line 478). "
            "Stand-in to exercise the reward trainer only.",
        )
        rejected = PreferenceResponse(
            response=_REJECTED_RESPONSE,
            scores=_rejected_scores(),
            notes="dry-run: SYNTHETIC label — not a human judgment (spec line 478). "
            "Stand-in to exercise the reward trainer only.",
        )
        pair = PreferencePair(
            pair_id=f"DRY-{idx + 1:04d}",
            category=_category_for_index(idx),
            prompt=_user_prompt(event),
            chosen=chosen,
            rejected=rejected,
            failing_criteria=[],
            apeiron=False,
            bootstrap=False,
            constitution_version=event.constitution_version,
        )
        # Defense-in-depth: a bug here would crash the dry-run reward stage
        # with a confusing load_human_pairs error, so assert validity up front.
        problems = validate_pair(pair)
        if problems:
            raise RuntimeError(
                f"synth pair {pair.pair_id} failed validate_pair: {problems} "
                "(this is a synth_pairs.py bug, not a data bug)"
            )
        pairs.append(pair)
    return pairs


# ── serialization helpers (mirror preference.py) ────────────────────────────
def serialize_dry_run_pairs_jsonl(pairs: list[PreferencePair]) -> str:
    """NDJSON (stable-keyed, one JSON object per line). Deterministic."""
    return serialize_pairs_jsonl(pairs)


def export_dry_run_pairs(pairs: list[PreferencePair], path: str | Path) -> None:
    """Write the dry-run pairs to JSONL for the reward stage to load. CPU-pure."""
    export_pairs_for_review(pairs, path)


def dry_run_pair_to_wire(pair: PreferencePair) -> dict[str, Any]:
    """Serialize one dry-run pair to the reference JSON schema (round-trips
    ``preference.pair_from_wire``). Exposed for tests."""
    return pair_to_wire(pair)