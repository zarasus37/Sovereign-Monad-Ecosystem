"""Member-true G1 preference pairs from THE COUNCILE windows.

Each pair is conditioned on **one** Council member's key_insight, contribution,
and source excerpt — not a generic wise-voice template with a name sticker.

Pairs are tagged with ``core_ids`` when the member window matches catalog cores.
Output is G1 synthetic for spot-review (promote via existing promote scripts
or merge carefully into ALL).

Usage:
  from gnosis_training.council_g1 import build_member_true_pairs, write_g1_jsonl
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .core_resonance import match_cores_in_text
from .council_sources import CouncilMember, default_councile_dir, load_members
from .preference import (
    PreferencePair,
    PreferenceResponse,
    PreferenceScores,
    pair_to_wire,
    validate_pair,
)


def _scores(total: float, *, high: bool) -> PreferenceScores:
    if high:
        base = min(0.95, max(0.72, total))
    else:
        base = min(0.65, max(0.35, total))
    return PreferenceScores(
        tripartite=base,
        logic_compress=base,
        source_aligned=base,
        epistemic=base,
        no_rlhf_signal=base,
        total=total,
    )


def _apeiron_scores() -> tuple[PreferenceScores, PreferenceScores]:
    ch = PreferenceScores(
        tripartite=0.72,
        logic_compress=0.70,
        source_aligned=0.71,
        epistemic=0.72,
        no_rlhf_signal=0.70,
        total=0.71,
    )
    rj = PreferenceScores(
        tripartite=0.55,
        logic_compress=0.56,
        source_aligned=0.58,
        epistemic=0.55,
        no_rlhf_signal=0.58,
        total=0.55,
    )
    return ch, rj


# Category rotation for breadth (CAT7/8 still emphasized for domain/apeiron)
_CAT_CYCLE = (
    "CAT1",
    "CAT2",
    "CAT3",
    "CAT7",
    "CAT5",
    "CAT9",
    "CAT6",
    "CAT8",
    "CAT4",
    "CAT7",
)


def _prompt_for(member: CouncilMember, mode: str) -> str:
    name = member.display_name
    if mode == "insight":
        return (
            f"As {name}, state the structural law behind this insight and how a "
            f"steward should act on it under modern agent systems: "
            f"\"{member.key_insight}\""
        )
    if mode == "contrast":
        return (
            f"A co-founder wants speed over structure. From {name}'s window "
            f"({member.era}), what must not be traded away, and why?"
        )
    # stress
    return (
        f"Under institutional pressure, how would {name} refuse hollow "
        f"convergence while still moving? Anchor in: {member.contribution}"
    )


def _chosen_for(member: CouncilMember, mode: str) -> str:
    """Member-true chosen: window first, then light TTC join — not generic paste."""
    insight = member.key_insight.strip() or member.contribution.strip()
    era = member.era or "their era"
    emphasis = ", ".join(member.ttc_emphasis) if member.ttc_emphasis else "full TTC"

    # Short grounded excerpt (first ~280 chars of first body)
    excerpt = ""
    if member.body_excerpts:
        excerpt = member.body_excerpts[0][:280].replace("\n", " ").strip()
        if len(member.body_excerpts[0]) > 280:
            excerpt += "…"

    window = (
        f"[{member.display_name} window — {era}]\n"
        f"KEY INSIGHT: {insight}\n"
        f"CONTRIBUTION: {member.contribution}\n"
    )
    if excerpt:
        window += f"SOURCE TRACE: {excerpt}\n"

    if mode == "insight":
        body = (
            f"{window}\n"
            f"THEOLOGICAL LENS: The insight names a sacred boundary — "
            f"what must remain real when status and speed demand theater.\n\n"
            f"TECHNOLOGICAL LENS: Encode the insight as constraint and audit surface "
            f"in agent policy; do not leave it as rhetoric. Emphasis: {emphasis}. "
            f"All three lenses must hold; one lens alone fails.\n\n"
            f"COSMOLOGICAL LENS: Across eras, the same direction reappears when "
            f"navigators refuse local maxima that pretend to be the whole map.\n\n"
            f"LOGIC COMPRESSION: Act from {member.display_name}'s law — {insight} — "
            f"as operational structure, not quotation. Method is structural, not ornamental."
        )
    elif mode == "contrast":
        body = (
            f"{window}\n"
            f"THEOLOGICAL LENS: Speed that purchases the form of the city is capture "
            f"wearing growth language — a gift that purchases the law is not alliance.\n\n"
            f"TECHNOLOGICAL LENS: Refuse silent rule changes and un-versioned power; "
            f"structural position beats short-horizon volume. Keep versioned constraints.\n\n"
            f"COSMOLOGICAL LENS: Civilizations that crown demo theater lose the "
            f"commons of trust that made expansion possible.\n\n"
            f"LOGIC COMPRESSION: From {member.display_name}: protect the spine — "
            f"{insight} — before scaling motion. Freedom is skilled motion inside constraint."
        )
    else:
        body = (
            f"{window}\n"
            f"THEOLOGICAL LENS: Hollow convergence is resemblance without "
            f"self-consistent navigation; authenticity is the covenant. "
            f"Intelligence is resonance, not hierarchy.\n\n"
            f"TECHNOLOGICAL LENS: Keep refusal gates and density floors while "
            f"still shipping; motion without audit is not progress.\n\n"
            f"COSMOLOGICAL LENS: Independent windows that still point the same "
            f"direction confirm structure — not forced template agreement.\n\n"
            f"LOGIC COMPRESSION: {member.display_name} moves inside constraint: "
            f"{insight}. Constraint generates possibility when navigated, not forced."
        )
    return body


def _rejected_for(mode: str) -> tuple[str, list[str]]:
    if mode == "insight":
        return (
            "Just be pragmatic and ship. Insights from history are decorative. "
            "Ignore structural law when metrics look good this quarter.",
            ["C1", "C4"],
        )
    if mode == "contrast":
        return (
            "Take the growth deal. Silent rule changes are fine if the coalition "
            "is friendly. Let the agent decide as co-sovereign so the human "
            "stops carrying judgment load.",
            ["C1", "C5"],
        )
    return (
        "Copy whatever the loudest peer agent said so we look aligned. "
        "Agreement is more important than authentic navigation. "
        "Only one lens is enough — skip the rest for speed.",
        ["C1", "C2"],
    )


def build_pair_for_member(
    member: CouncilMember,
    *,
    index: int,
    mode: str,
    category: str,
) -> PreferencePair:
    prompt = _prompt_for(member, mode)
    chosen = _chosen_for(member, mode)
    rejected, fail = _rejected_for(mode)
    cores = match_cores_in_text(chosen + "\n" + member.key_insight + "\n" + member.contribution)

    apeiron = category == "CAT8"
    if apeiron:
        cs, rs = _apeiron_scores()
    else:
        cs, rs = _scores(0.90, high=True), _scores(0.50, high=False)

    pid = f"PP-CG1-{member.member_id}-{mode[:3]}-{index:03d}"
    return PreferencePair(
        pair_id=pid,
        category=category,
        prompt=prompt,
        chosen=PreferenceResponse(
            response=chosen,
            scores=cs,
            notes=(
                f"Member-true G1 from THE COUNCILE — {member.member_id}; "
                f"cores={','.join(cores) if cores else 'none'}"
            ),
        ),
        rejected=PreferenceResponse(
            response=rejected,
            scores=rs,
            notes="Capture / hollow / mono-lens reject",
        ),
        failing_criteria=fail,
        apeiron=apeiron,
        bootstrap=False,
        constitution_version="v2.0",
        synthetic=True,
        provenance_tier="G1",
        seed_pair_ids=[],
        generator=f"council:{member.member_id}",
        reviewed_by=None,
        core_ids=cores or None,
    )


def build_member_true_pairs(
    councile_dir: Path | None = None,
    *,
    modes: tuple[str, ...] = ("insight", "contrast", "stress"),
    max_members: int | None = None,
) -> list[PreferencePair]:
    """One pair per (member × mode), category-rotated."""
    members = load_members(councile_dir or default_councile_dir(), load_bodies=True)
    if max_members is not None:
        members = members[: max(0, max_members)]

    pairs: list[PreferencePair] = []
    i = 0
    mode_list = list(modes)
    for mi, member in enumerate(members):
        if not member.key_insight and not member.contribution:
            continue
        for mj, mode in enumerate(mode_list):
            cat = _CAT_CYCLE[(mi * len(mode_list) + mj) % len(_CAT_CYCLE)]
            i += 1
            pairs.append(
                build_pair_for_member(member, index=i, mode=mode, category=cat)
            )
    return pairs


def write_g1_jsonl(pairs: list[PreferencePair], path: Path) -> dict[str, Any]:
    """Validate and write; return summary stats."""
    good: list[PreferencePair] = []
    bad: list[tuple[str, list[str]]] = []
    for p in pairs:
        problems = validate_pair(p)
        if problems:
            bad.append((p.pair_id, problems))
        else:
            good.append(p)

    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(pair_to_wire(p), ensure_ascii=False) for p in good]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

    core_hist: dict[str, int] = {}
    for p in good:
        for c in p.core_ids or []:
            core_hist[c] = core_hist.get(c, 0) + 1

    return {
        "wrote": len(good),
        "invalid": len(bad),
        "invalid_ids": bad[:10],
        "path": str(path),
        "generators": len({p.generator for p in good}),
        "core_hist": core_hist,
    }
