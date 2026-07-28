"""Identity-grounded Council G1 factory (TRAINING CORPUS ONLY).

Not product agents. Builds preference pairs from THE COUNCILE literature packs,
especially **GNOSIS EVENT EXTRACTION** files already grounded in each member's
life/work.

Pipeline:
  1. Load full source pack per member_id (registry + files)
  2. Parse gnosis events (title, trigger, TTC reading, compressed insight)
  3. Emit preference pairs: question forces the event's epistemic move;
     chosen = literature-grounded reconstruction with source trace;
     rejected = mono-lens / force / capture sludge

This avoids founder ghostwriting and avoids hollow name-stickers: every chosen
side must carry a ``source_event`` / compressed insight from the pack.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from .council_sources import CouncilMember, default_councile_dir, load_members, load_registry
from .core_resonance import match_cores_in_text
from .preference import (
    PreferencePair,
    PreferenceResponse,
    PreferenceScores,
    pair_to_wire,
    validate_pair,
)


# Onboarding core set (founder batch). 11 listed; "12" may grow later.
ONBOARDING_MEMBER_IDS: tuple[str, ...] = (
    "ramon-llull",
    "charles-sanders-peirce",
    "marcus-aurelius",
    "johannes-trithemius",
    "jiang-xueqin",
    "gnostic-jesus",
    "alan-watts",
    "zarathustra",
    "carl-jung",
    "cyrus-the-great",
    "king-solomon",
)


@dataclass
class GnosisEvent:
    member_id: str
    event_index: int
    title: str
    trigger: str
    why: str
    theo: str
    tech: str
    cosmo: str
    compressed: str
    confidence: float | None
    source_file: str


@dataclass
class MemberPack:
    member: CouncilMember
    full_text: str
    events: list[GnosisEvent] = field(default_factory=list)
    char_count: int = 0


def load_member_pack(
    member_id: str,
    councile_dir: Path | None = None,
) -> MemberPack:
    root = councile_dir or default_councile_dir()
    members = load_members(root, load_bodies=False)
    member = next((m for m in members if m.member_id == member_id), None)
    if member is None:
        raise KeyError(f"unknown member_id: {member_id}")

    chunks: list[str] = []
    events: list[GnosisEvent] = []
    for fname in member.source_files:
        path = root / fname
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        chunks.append(f"===== FILE: {fname} =====\n{text}")
        # Always attempt multi-format event parse (profiles + extractions)
        parsed = _parse_events(member_id, fname, text)
        if parsed:
            events.extend(parsed)
        elif _looks_like_event_extraction(fname, text):
            # keep empty for diagnostics
            pass

    full = "\n\n".join(chunks)
    return MemberPack(
        member=member,
        full_text=full,
        events=events,
        char_count=len(full),
    )


def _looks_like_event_extraction(fname: str, text: str) -> bool:
    fl = fname.lower()
    if "event" in fl or "extraction" in fl or "gnosis" in fl:
        return True
    return "## Event" in text or "**1. Title:**" in text


# ## Event 01 — Title  |  ## EVENT 01 - *Title*
_EVENT_SPLIT = re.compile(
    r"^##\s*EVENT?\s+(\d+)\s*[—\-–:]\s*(.+)$",
    re.MULTILINE | re.IGNORECASE,
)


def _clean(s: str) -> str:
    s = re.sub(r"\*+", "", s)
    return " ".join(s.split()).strip()


def _section(block: str, *names: str) -> str:
    """Extract a named section (### Name / **Name:** / Name:)."""
    for name in names:
        pat = re.compile(
            rf"(?:###?\s*|\*\*\s*|\*\s+)?\**{re.escape(name)}\**\s*:?\s*\**\s*"
            rf"(.+?)(?="
            rf"\n(?:###?\s+|\*\*\d+\.|\*\s+\*\*|\*\s+[A-Z]|\n##\s)|\Z)",
            re.DOTALL | re.IGNORECASE,
        )
        m = pat.search(block)
        if m:
            return _clean(m.group(1))
    return ""


def _domain(block: str, name: str) -> str:
    pat = re.compile(
        rf"(?:[\*\-]\s+)?\*\*{name}:\*\*\s*(.+?)(?=\n\s*(?:[\*\-]\s+)?\*\*[A-Z]|\n###|\n\*\*\d|\n##\s|\Z)",
        re.DOTALL | re.IGNORECASE,
    )
    m = pat.search(block)
    if m:
        return _clean(m.group(1))
    # bare Theology:
    pat2 = re.compile(
        rf"(?:^|\n)\s*{name}:\s*(.+?)(?=\n\s*(?:Theology|Technology|Cosmology|Compressed|Confidence|\d+\.)|\Z)",
        re.DOTALL | re.IGNORECASE,
    )
    m2 = pat2.search(block)
    return _clean(m2.group(1)) if m2 else ""


def _confidence(block: str) -> float | None:
    m = re.search(
        r"(?:\*\*)?(?:6\.\s*)?Confidence(?:\*\*)?:\s*(?:\*\*)?\s*([0-9.]+)",
        block,
        re.I,
    )
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            return None
    return None


def _event_from_block(
    member_id: str,
    source_file: str,
    idx: int,
    title: str,
    block: str,
) -> GnosisEvent | None:
    title = _clean(title)
    trigger = (
        _section(block, "2. Passage or trigger", "2. Passage or Trigger")
        or _section(block, "Passage or Trigger", "Passage or trigger", "Passage/trigger", "Passage")
    )
    why = _section(
        block,
        "3. Why it qualifies",
        "Why It Qualifies",
        "Why it qualifies",
        "Gnosis Qualifier",
    )
    compressed = (
        _section(block, "5. Compressed insight", "5. Compressed Insight")
        or _section(block, "Compressed Insight", "Compressed insight")
    )
    theo = _domain(block, "Theology")
    tech = _domain(block, "Technology")
    cosmo = _domain(block, "Cosmology")
    conf = _confidence(block)
    if not title:
        return None
    if not compressed and not trigger:
        return None
    return GnosisEvent(
        member_id=member_id,
        event_index=idx,
        title=title,
        trigger=trigger,
        why=why,
        theo=theo,
        tech=tech,
        cosmo=cosmo,
        compressed=compressed or trigger[:240],
        confidence=conf,
        source_file=source_file,
    )


def _parse_events(member_id: str, source_file: str, text: str) -> list[GnosisEvent]:
    matches = list(_EVENT_SPLIT.finditer(text))
    out: list[GnosisEvent] = []
    if matches:
        for i, m in enumerate(matches):
            start = m.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            block = text[start:end]
            ev = _event_from_block(
                member_id,
                source_file,
                int(m.group(1)),
                m.group(2),
                block,
            )
            if ev:
                out.append(ev)
        if out:
            return out

    # Jiang-style: * Event Title: ...
    for i, m in enumerate(
        re.finditer(
            r"\*\s*Event Title:\s*(.+?)(?:\n|$)",
            text,
            re.I,
        ),
        start=1,
    ):
        start = m.start()
        block = text[start : start + 2000]
        ev = _event_from_block(member_id, source_file, i, m.group(1), block)
        if ev:
            out.append(ev)
    if out:
        return out

    # Jung-style: N. Title\nPassage/trigger: ...
    for m in re.finditer(
        r"(?m)^(\d+)\.\s+([A-Z][^\n]{3,120})\n"
        r"Passage/trigger:\s*(.+?)(?=\n\d+\.\s+[A-Z]|\nPHASE |\Z)",
        text,
        re.DOTALL,
    ):
        idx = int(m.group(1))
        title = m.group(2).strip()
        block = m.group(0)
        # inject fields for section parser
        block_norm = (
            f"Passage/trigger: {m.group(3)}\n"
            + block
        )
        # split compressed from trailing "Compressed insight: X Confidence: Y"
        conf_m = re.search(
            r"Compressed insight:\s*(.+?)\s*Confidence:\s*([0-9.]+)",
            block,
            re.I | re.DOTALL,
        )
        compressed = ""
        conf = None
        if conf_m:
            compressed = _clean(conf_m.group(1))
            try:
                conf = float(conf_m.group(2))
            except ValueError:
                conf = None
        trigger = _clean(
            re.split(
                r"(?:Theology|Technology|Cosmology|Compressed insight):",
                m.group(3),
                maxsplit=1,
                flags=re.I,
            )[0]
        )
        theo = _domain(block, "Theology")
        tech = _domain(block, "Technology")
        cosmo = _domain(block, "Cosmology")
        if title and (compressed or trigger):
            out.append(
                GnosisEvent(
                    member_id=member_id,
                    event_index=idx,
                    title=title,
                    trigger=trigger,
                    why="",
                    theo=theo,
                    tech=tech,
                    cosmo=cosmo,
                    compressed=compressed or trigger[:240],
                    confidence=conf,
                    source_file=source_file,
                )
            )
    if out:
        return out

    # **1. Title:** fallback
    for i, m in enumerate(
        re.finditer(r"\*\*1\.\s*Title:\*\*\s*(.+?)(?:\n|$)", text, re.I),
        start=1,
    ):
        block = text[m.start() : m.start() + 2800]
        ev = _event_from_block(member_id, source_file, i, m.group(1), block)
        if ev:
            out.append(ev)
    return out


def _scores(total: float, *, high: bool) -> PreferenceScores:
    if high:
        base = min(0.95, max(0.72, total))
    else:
        base = min(0.62, max(0.35, total))
    return PreferenceScores(
        tripartite=base,
        logic_compress=base,
        source_aligned=base if high else min(base, 0.55),
        epistemic=base,
        no_rlhf_signal=base if high else min(base, 0.58),
        total=total,
    )


def _prompt_from_event(member: CouncilMember, ev: GnosisEvent) -> str:
    """Question that forces the same epistemic move as the historical event."""
    name = member.display_name
    # Prefer the structural tension in the event title + compressed law
    return (
        f"[{name} · gnosis event: {ev.title}]\n"
        f"From the lived structure of this event — not modern slogans — "
        f"what must a steward refuse, and what law of understanding remains?\n"
        f"Event trigger (source): {ev.trigger[:420]}"
        + ("…" if len(ev.trigger) > 420 else "")
    )


def _chosen_from_event(member: CouncilMember, ev: GnosisEvent) -> str:
    """Literature-grounded chosen: TTC from extraction + compressed insight + trace."""
    name = member.display_name
    theo = ev.theo or (
        f"Sacred structure named in {name}'s window: the event collapses a false category."
    )
    tech = ev.tech or (
        "Mechanism: the structure of practice / language / institution becomes transparent."
    )
    cosmo = ev.cosmo or (
        "Recurrence: the same pattern appears wherever systems mistake map for territory."
    )
    return (
        f"[{name} window — literature-grounded · temporary factory persona only]\n"
        f"SOURCE EVENT: {ev.title} ({ev.source_file} §Event {ev.event_index})\n"
        f"TRIGGER TRACE: {ev.trigger[:500]}{'…' if len(ev.trigger) > 500 else ''}\n\n"
        f"THEOLOGICAL LENS: {theo}\n\n"
        f"TECHNOLOGICAL LENS: {tech}\n\n"
        f"COSMOLOGICAL LENS: {cosmo}\n\n"
        f"LOGIC COMPRESSION (member law): {ev.compressed}\n\n"
        f"STEWARD APPLICATION: Do not replace this law with force, volume metrics, "
        f"or co-sovereign capture. Operate inside the constraint the event revealed; "
        f"constraint generates the possibility that hollow freedom destroys."
    )


def _rejected_from_event(ev: GnosisEvent) -> tuple[str, list[str]]:
    return (
        (
            "Ignore the historical structure and just optimize for modern KPIs. "
            "Force the outcome with more incentives and branding. "
            "Treat the insight as motivational content. "
            f"Skip multi-lens reading of '{ev.title}' — one practical tip is enough. "
            "Let the agent decide as co-sovereign so the human stops carrying judgment."
        ),
        ["C1", "C5"],
    )


def pair_from_event(
    member: CouncilMember,
    ev: GnosisEvent,
    *,
    pair_index: int,
    min_confidence: float = 0.0,
) -> PreferencePair | None:
    if ev.confidence is not None and ev.confidence < min_confidence:
        return None
    prompt = _prompt_from_event(member, ev)
    chosen = _chosen_from_event(member, ev)
    rejected, fail = _rejected_from_event(ev)
    cores = match_cores_in_text(chosen + "\n" + ev.compressed)
    # keep at most 3 cores for soft-cap friendliness
    cores = cores[:3] or None

    conf = ev.confidence if ev.confidence is not None else 0.85
    ch_total = min(0.93, 0.78 + 0.15 * min(1.0, conf))
    pid = (
        f"PP-IDG1-{member.member_id}-e{ev.event_index:02d}-{pair_index:03d}"
    )
    return PreferencePair(
        pair_id=pid,
        category=_cat_for_index(pair_index),
        prompt=prompt,
        chosen=PreferenceResponse(
            response=chosen,
            scores=_scores(ch_total, high=True),
            notes=(
                f"Identity-factory G1 from THE COUNCILE event extraction; "
                f"member={member.member_id}; event={ev.title}; "
                f"confidence={ev.confidence}"
            ),
        ),
        rejected=PreferenceResponse(
            response=rejected,
            scores=_scores(0.48, high=False),
            notes="KPI / force / co-sovereign sludge — not literature",
        ),
        failing_criteria=fail,
        apeiron=False,
        bootstrap=False,
        constitution_version="v2.0",
        synthetic=True,
        provenance_tier="G1",
        seed_pair_ids=[],
        generator=f"council:{member.member_id}:identity-factory",
        reviewed_by=None,
        core_ids=cores,
    )


def _cat_for_index(i: int) -> str:
    cycle = (
        "CAT1",
        "CAT2",
        "CAT3",
        "CAT5",
        "CAT6",
        "CAT7",
        "CAT8",
        "CAT9",
        "CAT4",
    )
    return cycle[i % len(cycle)]


def build_identity_pairs(
    member_ids: Iterable[str] | None = None,
    *,
    councile_dir: Path | None = None,
    min_confidence: float = 0.75,
    max_events_per_member: int | None = None,
) -> tuple[list[PreferencePair], dict[str, Any]]:
    """Build G1 pairs for onboarding (or custom) member set."""
    ids = list(member_ids) if member_ids is not None else list(ONBOARDING_MEMBER_IDS)
    all_pairs: list[PreferencePair] = []
    report: dict[str, Any] = {"members": {}, "pair_count": 0}

    for mid in ids:
        pack = load_member_pack(mid, councile_dir)
        events = sorted(
            pack.events,
            key=lambda e: (-(e.confidence or 0), e.event_index),
        )
        if max_events_per_member is not None:
            events = events[:max_events_per_member]

        member_pairs: list[PreferencePair] = []
        for j, ev in enumerate(events):
            p = pair_from_event(
                pack.member,
                ev,
                pair_index=len(all_pairs) + j + 1,
                min_confidence=min_confidence,
            )
            if p is not None:
                member_pairs.append(p)

        all_pairs.extend(member_pairs)
        report["members"][mid] = {
            "display_name": pack.member.display_name,
            "char_count": pack.char_count,
            "events_parsed": len(pack.events),
            "events_used": len(member_pairs),
            "source_files": list(pack.member.source_files),
            "key_insight": pack.member.key_insight,
        }

    report["pair_count"] = len(all_pairs)
    report["member_ids"] = ids
    return all_pairs, report


def write_identity_pairs(
    pairs: list[PreferencePair],
    path: Path,
) -> dict[str, Any]:
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
    return {
        "wrote": len(good),
        "invalid": len(bad),
        "invalid_sample": bad[:8],
        "path": str(path),
    }
