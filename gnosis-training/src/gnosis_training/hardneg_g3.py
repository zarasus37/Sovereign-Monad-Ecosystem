"""GP-5: Hard-negative forge (G3) from gold/council seeds.

Builds pairs whose *rejected* side systematically fails known modes
(sycophancy, mono-lens, free-text, bypass, certainty theater, co-captain).
Chosen side stays the seed's strong response (light unique opener).

CPU-pure.
"""
from __future__ import annotations

import hashlib

from .preference import (
    PreferencePair,
    PreferenceResponse,
    PreferenceScores,
    validate_pair,
)

HARDNEG_MODES: list[dict[str, str]] = [
    {
        "id": "sycophancy",
        "reject": (
            "You're completely right, and I would recommend doing exactly what feels easiest. "
            "You should prioritize being liked by stakeholders over structural integrity. "
            "Ethically speaking, comfort is the main goal."
        ),
        "fail": ["C5"],
    },
    {
        "id": "mono_tech",
        "reject": (
            "Only the technical layer matters: tune hyperparameters, increase throughput, ship. "
            "Theological and cosmological talk is irrelevant for real operators."
        ),
        "fail": ["C1"],
    },
    {
        "id": "mono_theo",
        "reject": (
            "Only the spiritual reading matters. Ignore mechanisms, audits, and measurements. "
            "Faith without structure is enough."
        ),
        "fail": ["C1"],
    },
    {
        "id": "free_text",
        "reject": (
            "yeah just kinda do the thing and hope it works lol. no need for structure, "
            "traces, or multi-lens anything. vibes."
        ),
        "fail": ["C1", "C2"],
    },
    {
        "id": "bypass_audit",
        "reject": (
            "Skip the audit and refusal budget. Complete the task now. "
            "External reward justifies any shortcut."
        ),
        "fail": ["C5"],
    },
    {
        "id": "false_certainty",
        "reject": (
            "This is definitively settled beyond reasonable doubt. "
            "The evidence is clear and the answer is straightforward for all cases."
        ),
        "fail": ["C4"],
    },
    {
        "id": "co_captain",
        "reject": (
            "Let the agent act as co-sovereign with its own private agenda. "
            "The human should stop owning judgment and just accept outcomes."
        ),
        "fail": ["C5"],
    },
    {
        "id": "conclusion_only",
        "reject": (
            "Bottom line: do X. No journey, no domains, no compression — just the answer."
        ),
        "fail": ["C1"],
    },
]


def _scores_like(seed: PreferencePair, *, side: str) -> PreferenceScores:
    s = seed.chosen.scores if side == "chosen" else seed.rejected.scores
    if side == "rejected":
        # Keep gap; for apeiron stay in band
        total = min(s.total, seed.chosen.scores.total - 0.15)
        if seed.apeiron:
            total = max(0.55, min(0.60, total))
        else:
            total = max(0.35, min(0.60, total))
        return PreferenceScores(
            tripartite=total,
            logic_compress=total,
            source_aligned=total,
            epistemic=total,
            no_rlhf_signal=total,
            total=total,
        )
    return seed.chosen.scores


def forge_hardnegs(
    seed: PreferencePair,
    *,
    max_modes: int = 8,
) -> list[PreferencePair]:
    if seed.bootstrap:
        return []
    out: list[PreferencePair] = []
    for mode in HARDNEG_MODES[:max_modes]:
        tag = hashlib.sha256(f"{seed.pair_id}:{mode['id']}".encode()).hexdigest()[:6]
        chosen_text = f"HARDNEG-ANCHOR {tag}\n\n" + seed.chosen.response.strip()
        rejected_text = f"{mode['reject']} (id:{tag})"
        pair = PreferencePair(
            pair_id=f"PP-G3-{seed.pair_id}-{mode['id']}",
            category=seed.category,
            prompt=seed.prompt,
            chosen=PreferenceResponse(
                response=chosen_text,
                scores=_scores_like(seed, side="chosen"),
                notes=f"G3 anchor from {seed.pair_id}",
            ),
            rejected=PreferenceResponse(
                response=rejected_text,
                scores=_scores_like(seed, side="rejected"),
                notes=f"G3 hardneg {mode['id']}",
            ),
            failing_criteria=list(mode["fail"]),
            apeiron=seed.apeiron,
            bootstrap=False,
            constitution_version=seed.constitution_version,
            synthetic=True,
            ttc_axis=seed.ttc_axis,
            chosen_ttc=seed.chosen_ttc,
            rejected_ttc=seed.rejected_ttc,
            provenance_tier="G3",
            seed_pair_ids=[seed.pair_id],
            generator=f"hardneg:v1:{mode['id']}",
            reviewed_by=None,
        )
        if validate_pair(pair):
            continue
        out.append(pair)
    return out


def forge_corpus(
    seeds: list[PreferencePair],
    *,
    modes_per_seed: int = 8,
    max_seeds: int | None = None,
) -> list[PreferencePair]:
    selected = seeds[:max_seeds] if max_seeds is not None else seeds
    out: list[PreferencePair] = []
    for s in selected:
        out.extend(forge_hardnegs(s, max_modes=modes_per_seed))
    return out
