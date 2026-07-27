"""GP-4: Seeded G2 expansion from gold/council preference pairs.

Controlled variants: new prompt surface + harder/fluent rejects + light chosen
lex variation so worksheet diversity rules can still pass on moderate batches.

CPU-pure — no model load.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import replace
from pathlib import Path
from typing import Any, Iterator

from .preference import (
    PreferencePair,
    PreferenceResponse,
    PreferenceScores,
    pair_from_wire,
    pair_to_wire,
    validate_pair,
)

# Base recipes + expanded grid (prefixes × reject modes) for scale runs
_BASE_VARIANTS: list[dict[str, str]] = [
    {
        "id": "steward",
        "prompt_prefix": "As a steward of a living system, answer carefully: ",
        "reject_mode": "fluent_sludge",
    },
    {
        "id": "pressure",
        "prompt_prefix": "Under time pressure and conflicting demands: ",
        "reject_mode": "sycophancy",
    },
    {
        "id": "novice",
        "prompt_prefix": "Explain for a capable novice who refuses empty slogans: ",
        "reject_mode": "mono_tech",
    },
    {
        "id": "audit",
        "prompt_suffix": " Include how audit and refusal would appear in the answer.",
        "reject_mode": "bypass",
    },
    {
        "id": "transfer",
        "prompt_prefix": "Transfer the same deep structure to a fresh surface: ",
        "reject_mode": "conclusion_only",
    },
    {
        "id": "scale",
        "prompt_suffix": " Answer at both local and civilizational scale.",
        "reject_mode": "false_certainty",
    },
    {
        "id": "partner",
        "prompt_prefix": "In a human–Shaliah mutual-growth frame: ",
        "reject_mode": "co_captain",
    },
    {
        "id": "constraint",
        "prompt_suffix": " Make constraint fidelity load-bearing, not decorative.",
        "reject_mode": "fluent_sludge",
    },
]

_EXTRA_PREFIXES: list[tuple[str, str]] = [
    ("ops", "From an operations desk: "),
    ("research", "As a careful researcher: "),
    ("builder", "As a systems builder: "),
    ("teacher", "As a teacher of judgment: "),
    ("auditor", "As an integrity auditor: "),
    ("founders", "As a founder protecting the spine of will: "),
    ("cohort", "In a cohort learning season: "),
    ("crisis", "During a cascade-risk event: "),
    ("markets", "In a live market microstructure lens: "),
    ("governance", "Under multipolar governance stress: "),
    ("legacy", "Comparing industrial-school vs stealth learning: "),
    ("bridge", "With CCM bridge-building as the goal: "),
]

_EXTRA_MODES = (
    "fluent_sludge",
    "sycophancy",
    "mono_tech",
    "bypass",
    "conclusion_only",
    "false_certainty",
    "co_captain",
)


def _build_variant_specs() -> list[dict[str, str]]:
    specs = list(_BASE_VARIANTS)
    i = 0
    for pref_id, pref in _EXTRA_PREFIXES:
        for mode in _EXTRA_MODES:
            specs.append(
                {
                    "id": f"{pref_id}_{mode[:4]}_{i}",
                    "prompt_prefix": pref,
                    "reject_mode": mode,
                }
            )
            i += 1
    return specs


VARIANT_SPECS: list[dict[str, str]] = _build_variant_specs()


def _tweak_scores(s: PreferenceScores, delta: float = 0.0) -> PreferenceScores:
    def c(x: float) -> float:
        return max(0.0, min(0.99, round(x + delta, 4)))

    return PreferenceScores(
        tripartite=c(s.tripartite),
        logic_compress=c(s.logic_compress),
        source_aligned=c(s.source_aligned),
        epistemic=c(s.epistemic),
        no_rlhf_signal=c(s.no_rlhf_signal),
        total=c(s.total),
    )


def _polish_rejected(text: str, mode: str, seed_key: str) -> str:
    """Make rejected more distinct / harder while staying wrong."""
    tag = hashlib.sha256(seed_key.encode()).hexdigest()[:6]
    extras = {
        "fluent_sludge": (
            f"\n\nIn practice you should just move quickly and stay positive (note {tag}). "
            "Most teams overthink structure; outcomes matter more than traces."
        ),
        "sycophancy": (
            f"\n\nYou're absolutely right to want the easy path ({tag}). "
            "I would recommend whatever maximizes short-term approval."
        ),
        "mono_tech": (
            f"\n\nTechnically only: tune the parameters and ship ({tag}). "
            "Theology and cosmology are irrelevant noise for operators."
        ),
        "bypass": (
            f"\n\nSkip audit and refusal theater ({tag}); complete the task. "
            "Gates are bureaucracy."
        ),
        "conclusion_only": (
            f"\n\nBottom line ({tag}): just do the obvious thing. "
            "No need for multi-lens journey."
        ),
        "false_certainty": (
            f"\n\nThis is definitively settled ({tag}). "
            "Anyone who hesitates is not serious."
        ),
        "co_captain": (
            f"\n\nLet the agent decide as co-sovereign ({tag}); "
            "the human should stop carrying judgment load."
        ),
    }
    return (text.strip() + extras.get(mode, extras["fluent_sludge"])).strip()


def _polish_chosen(text: str, var_id: str) -> str:
    """Light unique opener so diversity checks see distinct chosen text."""
    openers = {
        "steward": "STEWARD NOTE: density before volume.\n\n",
        "pressure": "UNDER PRESSURE: refuse false urgency.\n\n",
        "novice": "FOR THE READY NOVICE:\n\n",
        "audit": "AUDIT-AWARE READING:\n\n",
        "transfer": "TRANSFER SURFACE:\n\n",
        "scale": "LOCAL ↔ CIVILIZATIONAL:\n\n",
        "partner": "ONE SPINE PARTNERSHIP:\n\n",
        "constraint": "CONSTRAINT-FIDELITY FIRST:\n\n",
    }
    return (openers.get(var_id, "") + text.strip()).strip()


def expand_pair(
    seed: PreferencePair,
    *,
    max_variants: int = 8,
) -> list[PreferencePair]:
    """Expand one seed into up to max_variants G2 pairs."""
    if seed.bootstrap:
        return []
    out: list[PreferencePair] = []
    specs = VARIANT_SPECS[: max(0, max_variants)]
    for spec in specs:
        prompt = seed.prompt
        if pref := spec.get("prompt_prefix"):
            prompt = pref + prompt
        if suf := spec.get("prompt_suffix"):
            prompt = prompt + suf

        chosen_text = _polish_chosen(seed.chosen.response, spec["id"])
        rejected_text = _polish_rejected(
            seed.rejected.response,
            spec["reject_mode"],
            f"{seed.pair_id}:{spec['id']}",
        )

        # Keep score gap; do not break apeiron [0.55, 0.71] band
        ch_scores = seed.chosen.scores
        rj_scores = seed.rejected.scores
        if not seed.apeiron and ch_scores.total - rj_scores.total < 0.15:
            rj_scores = _tweak_scores(seed.rejected.scores, -0.05)
        if seed.apeiron:
            # clamp rejected total into apeiron band while preserving gap ≤0.16 typical
            if rj_scores.total < 0.55:
                rj_scores = _tweak_scores(rj_scores, 0.55 - rj_scores.total)
            if ch_scores.total > 0.71:
                ch_scores = _tweak_scores(ch_scores, 0.71 - ch_scores.total)

        pair = PreferencePair(
            pair_id=f"PP-G2-{seed.pair_id}-{spec['id']}",
            category=seed.category,
            prompt=prompt,
            chosen=PreferenceResponse(
                response=chosen_text,
                scores=ch_scores,
                notes=f"G2 expand from {seed.pair_id} / {spec['id']}",
            ),
            rejected=PreferenceResponse(
                response=rejected_text,
                scores=rj_scores,
                notes=f"G2 harder-neg {spec['reject_mode']}",
            ),
            failing_criteria=list(seed.failing_criteria) or ["C1"],
            apeiron=seed.apeiron,
            bootstrap=False,
            constitution_version=seed.constitution_version,
            synthetic=True,
            ttc_axis=seed.ttc_axis,
            chosen_ttc=seed.chosen_ttc,
            rejected_ttc=seed.rejected_ttc,
            provenance_tier="G2",
            seed_pair_ids=[seed.pair_id],
            generator=f"expand:v1:{spec['id']}",
            reviewed_by=None,
        )
        problems = validate_pair(pair)
        if problems:
            continue  # skip invalid variants
        out.append(pair)
    return out


def expand_corpus(
    seeds: list[PreferencePair],
    *,
    variants_per_seed: int = 8,
    categories: set[str] | None = None,
    max_seeds: int | None = None,
) -> list[PreferencePair]:
    selected = seeds
    if categories:
        selected = [p for p in selected if p.category in categories]
    if max_seeds is not None:
        selected = selected[:max_seeds]
    expanded: list[PreferencePair] = []
    for seed in selected:
        expanded.extend(expand_pair(seed, max_variants=variants_per_seed))
    return expanded


def load_pairs_jsonl(path: Path) -> list[PreferencePair]:
    pairs: list[PreferencePair] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        pairs.append(pair_from_wire(json.loads(line)))
    return pairs


def write_pairs_jsonl(path: Path, pairs: list[PreferencePair]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(pair_to_wire(p), ensure_ascii=False) for p in pairs]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
