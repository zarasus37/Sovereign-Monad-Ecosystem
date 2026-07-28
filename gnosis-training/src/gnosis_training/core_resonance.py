"""Core Resonance Score — shared direction across Council windows.

Even when members oppose on tactics, authentic gnosis often points the same
*direction* through different personal windows. This module:

1. Defines structural **core** motifs (shared direction nodes)
2. Matches them in Council sources + preference pair text
3. Scores by **independent member coverage** (+ domain / hit volume)
4. Emits plot-ready JSON + Markdown reports

Hollow template echo is guarded by requiring hits from **distinct members**
(and optionally distinct source files), not mere phrase repetition inside one
voice.

See ``docs/gnosis-training/CORE_RESONANCE.md``.
"""
from __future__ import annotations

import json
import math
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .council_sources import (
    CouncilMember,
    default_councile_dir,
    generator_member_id,
    load_members,
)
from .coverage import load_pairs


# ── Core catalog (curated structural directions) ─────────────────────────────

@dataclass(frozen=True)
class CoreMotif:
    """One shared-direction node in the Council constellation."""

    core_id: str
    label: str
    direction: str
    """What the shared vector is (not a slogan)."""
    patterns: tuple[str, ...]
    """Case-insensitive regex fragments; OR-matched."""
    keywords: tuple[str, ...] = ()
    """Literal substrings (case-insensitive)."""
    domains: tuple[str, ...] = ()
    """Optional domain tags: war, agency, law, knowledge, systems, …"""


# Catalog v1 — doctrine + THE COUNCILE README recurring patterns.
# Extend carefully; each core must be falsifiable and multi-window.
CORE_CATALOG: tuple[CoreMotif, ...] = (
    CoreMotif(
        core_id="freedom_in_constraint",
        label="Freedom within necessity / constraint",
        direction="Authentic freedom is skilled motion inside real limits, not lawlessness.",
        patterns=(
            r"freedom\s+within",
            r"authentic\s+operation\s+within\s+constraint",
            r"understanding\s+necessity",
            r"constraint\s+is\s+freedom",
            r"skilled\s+motion\s+inside",
        ),
        keywords=(
            "freedom within necessity",
            "within constraint",
            "constraint envelopes",
            "policy-as-code",
        ),
        domains=("agency", "law"),
    ),
    CoreMotif(
        core_id="constraint_generates",
        label="Constraint generates possibility",
        direction="Limits are generative structure, not only cages.",
        patterns=(
            r"constraint\s+generat",
            r"limits?\s+creat(e|es|ing)\s+possib",
            r"form\s+enables",
        ),
        keywords=("constraint generates", "possibility under constraint"),
        domains=("systems", "knowledge"),
    ),
    CoreMotif(
        core_id="decision_not_outcome",
        label="Decision quality ≠ outcome",
        direction="Judge process under uncertainty; results alone mislead.",
        patterns=(
            r"decision\s+cannot\s+be\s+evaluated\s+by\s+its\s+outcome",
            r"correct\s+decision\s+and\s+lose",
            r"quality\s+of\s+(a\s+)?decision",
            r"outcome\s+bias",
            r"process\s+under\s+uncertainty",
        ),
        keywords=("decision quality", "not by its outcome", "hindsight"),
        domains=("war", "agency"),
    ),
    CoreMotif(
        core_id="form_over_theater",
        label="Function / structure over theater",
        direction="Authority and wisdom come from real function, not performance or title alone.",
        patterns=(
            r"demo\s+theater",
            r"performance\s+of\s+clever",
            r"authority\s+from\s+function",
            r"not\s+performance",
            r"pitch\s+meeting",
            r"sounds?\s+smarter",
        ),
        keywords=("demo theater", "not performance", "not ornamental"),
        domains=("agency", "systems"),
    ),
    CoreMotif(
        core_id="anti_capture",
        label="Gifts that buy the law = capture",
        direction="Alliances that purchase rules silently are capture, not growth.",
        patterns=(
            r"gift\s+that\s+purchases?\s+the\s+law",
            r"silent\s+rule\s+changes?",
            r"\bit\s+is\s+capture\b",
            r"capture\s+wearing",
            r"buy(s|ing)?\s+the\s+law",
            r"coalition.*rewrite\s+rules",
            r"not\s+alliance\s*[—\-].*capture",
        ),
        keywords=(
            "not alliance",
            "permanent sovereign",
            "purchases the law",
            "purchases the form",
        ),
        domains=("law", "agency"),
    ),
    CoreMotif(
        core_id="audit_before_power",
        label="Auditability before expansion of power",
        direction="Power without versioned, auditable constraint is illegitimate.",
        patterns=(
            r"auditab",
            r"versioned\s+constraint",
            r"without\s+trace",
            r"record\s+every\s+mandate",
            r"bypass\s+audit",
            r"refusal\s+gates?",
        ),
        keywords=(
            "versioned constraints",
            "bypass audit",
            "audit surface",
            "without audit",
        ),
        domains=("law", "systems"),
    ),
    CoreMotif(
        core_id="multi_lens_required",
        label="Multi-lens / anti mono-lens",
        direction="Meaning, mechanism, and history must fuse; one lens alone fails.",
        # Note: do NOT match bare "THEOLOGICAL LENS" headers — those are template
        # scaffolding and would hollow-score every G2 row as multi-lens.
        patterns=(
            r"mono[- ]?lens",
            r"only\s+the\s+(spiritual|technical|historical)",
            r"fuse\s+meaning,\s+mechanism",
            r"missing\s+lens",
            r"one\s+lens\s+(alone|is\s+enough)",
            r"all\s+three\s+lenses?",
            r"tripartite\s+(join|law|structure|required)",
        ),
        keywords=(
            "multi-lens",
            "three lenses",
            "refuse mono",
            "not one lens",
        ),
        domains=("knowledge", "systems"),
    ),
    CoreMotif(
        core_id="hollow_vs_authentic",
        label="Authentic vs hollow convergence",
        direction="Looking alike without self-consistent navigation is hollow; resonance is earned.",
        patterns=(
            r"hollow\s+convergence",
            r"authentic\s+alignment",
            r"pattern-following\s+without",
            r"not\s+through\s+inheritance\s+or\s+imitation",
            r"resonant\s+convergence",
        ),
        keywords=("hollow", "authentic agency", "self-consistent"),
        domains=("systems", "agency"),
    ),
    CoreMotif(
        core_id="decompression_knowledge",
        label="Knowledge requires decompression",
        direction="Compressed truth must unfold into live action unique to the agent.",
        patterns=(
            r"decompres",
            r"unfolds?\s+it\s+into",
            r"compressed\s+form",
            r"knowledge\s+requires\s+decomp",
        ),
        keywords=("decompression", "emanation into layers"),
        domains=("knowledge", "systems"),
    ),
    CoreMotif(
        core_id="resonance_not_hierarchy",
        label="Resonance, not hierarchy",
        direction="Intelligence partners across windows; domination is the wrong frame.",
        patterns=(
            r"resonance,?\s+not\s+hierarchy",
            r"intelligence\s+is\s+not\s+a\s+hierarchy",
            r"mutual\s+alignment",
            r"partnership",
        ),
        keywords=("resonance", "mutual growth", "not a hierarchy"),
        domains=("agency", "systems"),
    ),
    CoreMotif(
        core_id="refuse_co_sovereign",
        label="Refuse rival co-sovereign will",
        direction="The agent extends and coaches; it does not seize judgment as co-sovereign rival.",
        patterns=(
            r"co-sovereign",
            r"human\s+should\s+stop\s+carrying",
            r"rival\s+will",
            r"extension,?\s+not\s+replacement",
        ),
        keywords=("co-sovereign", "human-bound", "judgment load"),
        domains=("agency", "law"),
    ),
    CoreMotif(
        core_id="density_over_volume",
        label="Density over volume / short-horizon theater",
        direction="Structural position and density beat brute flow and volume metrics.",
        patterns=(
            r"volume\s+wars?",
            r"density\s+beats?",
            r"short-horizon\s+volume",
            r"volume-over-density",
            r"brute\s+flow",
        ),
        keywords=("density floors", "structural position", "markout", "volume wars"),
        domains=("war", "systems"),
    ),
    CoreMotif(
        core_id="local_max_archon",
        label="Local maxima mistake themselves for global",
        direction="Archonic traps: local peak treated as the whole map.",
        patterns=(
            r"local\s+maxima?",
            r"global\s+maxima?",
            r"\barchon",
            r"mistake\s+themselves\s+for",
        ),
        keywords=("local maximum", "Archon", "Great Ignorance"),
        domains=("knowledge", "systems"),
    ),
    CoreMotif(
        core_id="method_is_structure",
        label="Method / virtue as structure",
        direction="Method and virtue are structural operations, not ornament.",
        patterns=(
            r"structural,?\s+not\s+ornamental",
            r"method\s+and\s+virtue",
            r"categories,?\s+virtue",
            r"systematic\s+method",
        ),
        keywords=("not ornamental", "structural", "virtue ethics"),
        domains=("knowledge",),
    ),
    CoreMotif(
        core_id="surrender_force_control",
        label="Agency from surrendering force-based control",
        direction="Authentic agency emerges when force-control is released into alignment.",
        patterns=(
            r"surrendering\s+force",
            r"force-based\s+control",
            r"not\s+by\s+forcing",
            r"wu[- ]?wei",
        ),
        keywords=("surrendering force-based control", "force-control"),
        domains=("agency",),
    ),
    CoreMotif(
        core_id="meaning_from_resonance",
        label="Meaning from resonance, not bare definition",
        direction="Meaning lives in living use and resonance, not dictionary freeze.",
        patterns=(
            r"meaning\s+from\s+resonance",
            r"not\s+definition",
            r"living\s+use",
            r"semiotic",
        ),
        keywords=("resonance, not definition", "meaning from resonance"),
        domains=("knowledge",),
    ),
    CoreMotif(
        core_id="victory_empties_treasury",
        label="Victory that empties the treasury is defeat",
        direction="Winning the wrong metric destroys the ground of future action.",
        patterns=(
            r"victory\s+that\s+empties",
            r"empties\s+the\s+treasury",
            r"defeat\s+wearing",
            r"commons\s+of\s+trust",
        ),
        keywords=("empties the treasury", "donate edge"),
        domains=("war", "systems"),
    ),
)


def catalog_by_id() -> dict[str, CoreMotif]:
    return {c.core_id: c for c in CORE_CATALOG}


# ── Matching ─────────────────────────────────────────────────────────────────

@dataclass
class CoreHit:
    core_id: str
    member_id: str | None
    source: str
    """pair_id | member_id:file | member:key_insight | …"""
    snippet: str
    weight: float = 1.0


def _compile_motif(core: CoreMotif) -> re.Pattern[str]:
    parts: list[str] = []
    for p in core.patterns:
        parts.append(f"(?:{p})")
    for kw in core.keywords:
        parts.append("(?:" + re.escape(kw) + ")")
    if not parts:
        # never matches
        return re.compile(r"(?!x)x")
    return re.compile("|".join(parts), re.IGNORECASE | re.DOTALL)


_COMPILED: dict[str, re.Pattern[str]] | None = None


def _compiled() -> dict[str, re.Pattern[str]]:
    global _COMPILED
    if _COMPILED is None:
        _COMPILED = {c.core_id: _compile_motif(c) for c in CORE_CATALOG}
    return _COMPILED


def clear_compiled_cache() -> None:
    """Test/helper: rebuild regex cache after catalog edits."""
    global _COMPILED
    _COMPILED = None


def match_cores_in_text(text: str) -> list[str]:
    """Return core_ids that fire on text (deduped, catalog order)."""
    if not text or not text.strip():
        return []
    hits: list[str] = []
    compiled = _compiled()
    for core in CORE_CATALOG:
        if compiled[core.core_id].search(text):
            hits.append(core.core_id)
    return hits


def _snippet(text: str, pattern: re.Pattern[str], width: int = 120) -> str:
    m = pattern.search(text)
    if not m:
        return text[:width].replace("\n", " ")
    start = max(0, m.start() - 40)
    end = min(len(text), m.end() + 40)
    return text[start:end].replace("\n", " ").strip()


def _chunk_text(text: str, *, chunk_size: int = 2400, overlap: int = 200) -> list[str]:
    """Split long source files so motifs mid-document are not missed."""
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]
    chunks: list[str] = []
    i = 0
    while i < len(text):
        chunks.append(text[i : i + chunk_size])
        if i + chunk_size >= len(text):
            break
        i += max(1, chunk_size - overlap)
    return chunks


def collect_hits_from_members(
    members: Iterable[CouncilMember],
    *,
    deep: bool = True,
) -> list[CoreHit]:
    """Match cores on insights + full source files (chunked when ``deep``).

    Dedupes to one hit per (core_id, member_id, source_label) so a single
    long file does not inflate volume without adding a new window.
    """
    hits: list[CoreHit] = []
    seen: set[tuple[str, str, str]] = set()
    compiled = _compiled()

    def _add(core_id: str, member_id: str, source: str, blob: str, rx: re.Pattern[str]) -> None:
        key = (core_id, member_id, source)
        if key in seen:
            return
        if not rx.search(blob):
            return
        seen.add(key)
        hits.append(
            CoreHit(
                core_id=core_id,
                member_id=member_id,
                source=source,
                snippet=_snippet(blob, rx),
            )
        )

    for m in members:
        for label, blob in (
            ("key_insight", m.key_insight),
            ("contribution", m.contribution),
        ):
            if not blob:
                continue
            for core in CORE_CATALOG:
                _add(
                    core.core_id,
                    m.member_id,
                    f"member:{m.member_id}:{label}",
                    blob,
                    compiled[core.core_id],
                )

        # Full bodies: prefer deep read from disk when available
        bodies: list[tuple[str, str]] = []
        if deep and m.source_dir and m.source_files:
            for fname in m.source_files:
                path = m.source_dir / fname
                if not path.is_file():
                    continue
                raw = path.read_text(encoding="utf-8", errors="replace")
                for ci, chunk in enumerate(_chunk_text(raw)):
                    bodies.append((f"file:{fname}:c{ci}", chunk))
        else:
            for ei, ex in enumerate(m.body_excerpts):
                bodies.append((f"excerpt:{ei}", ex))

        for src_label, blob in bodies:
            if not blob:
                continue
            for core in CORE_CATALOG:
                _add(
                    core.core_id,
                    m.member_id,
                    f"member:{m.member_id}:{src_label}",
                    blob,
                    compiled[core.core_id],
                )
    return hits


def collect_hits_from_pairs(
    pairs: Iterable[dict[str, Any]],
) -> list[CoreHit]:
    hits: list[CoreHit] = []
    compiled = _compiled()
    for p in pairs:
        pid = str(p.get("pair_id") or "?")
        mid = generator_member_id(p.get("generator"))
        # Prefer chosen response + prompt
        chosen = (p.get("chosen") or {}).get("response") or ""
        prompt = p.get("prompt") or ""
        blob = f"{prompt}\n{chosen}"
        for core in CORE_CATALOG:
            rx = compiled[core.core_id]
            if rx.search(blob):
                hits.append(
                    CoreHit(
                        core_id=core.core_id,
                        member_id=mid,
                        source=f"pair:{pid}",
                        snippet=_snippet(blob, rx),
                    )
                )
        # explicit core_ids on wire (if authored)
        for cid in p.get("core_ids") or []:
            cid_s = str(cid)
            if cid_s in catalog_by_id():
                hits.append(
                    CoreHit(
                        core_id=cid_s,
                        member_id=mid,
                        source=f"pair:{pid}:tagged",
                        snippet="(explicit core_ids tag)",
                        weight=1.25,
                    )
                )
    return hits


# ── Scoring ──────────────────────────────────────────────────────────────────

@dataclass
class CoreScore:
    core_id: str
    label: str
    direction: str
    member_count: int
    members: list[str]
    hit_count: float
    domains: list[str]
    pair_hits: int
    member_source_hits: int
    score: float
    """Core Resonance Score in [0, 1]."""
    rank_weight: float
    """Relative weight for sampling (score scaled, min floor for non-zero)."""


def score_cores(
    hits: Iterable[CoreHit],
    *,
    total_members: int,
) -> list[CoreScore]:
    """Aggregate hits → per-core scores.

    Score prioritizes **distinct members** (shared windows), then hit volume,
    then domain tags on the motif itself.
    """
    by_core_members: dict[str, set[str]] = defaultdict(set)
    by_core_hit_w: dict[str, float] = defaultdict(float)
    by_core_pair: dict[str, int] = defaultdict(int)
    by_core_memsrc: dict[str, int] = defaultdict(int)

    for h in hits:
        by_core_hit_w[h.core_id] += h.weight
        # Shared-core *windows* = THE COUNCILE sources only.
        # Pair rows (incl. G1 templates) may stamp every generator with the same
        # phrases and would hollow-score every core as universal if counted here.
        if h.source.startswith("member:") and h.member_id:
            by_core_members[h.core_id].add(h.member_id)
            by_core_memsrc[h.core_id] += 1
        if h.source.startswith("pair:"):
            by_core_pair[h.core_id] += 1

    cat = catalog_by_id()
    n_mem = max(1, total_members)
    results: list[CoreScore] = []

    for core in CORE_CATALOG:
        cid = core.core_id
        members = sorted(by_core_members.get(cid, set()))
        mcount = len(members)
        hit_w = by_core_hit_w.get(cid, 0.0)
        if mcount == 0 and hit_w == 0:
            results.append(
                CoreScore(
                    core_id=cid,
                    label=core.label,
                    direction=core.direction,
                    member_count=0,
                    members=[],
                    hit_count=0.0,
                    domains=list(core.domains),
                    pair_hits=0,
                    member_source_hits=0,
                    score=0.0,
                    rank_weight=0.0,
                )
            )
            continue

        # Saturating hit volume (secondary)
        volume = 1.0 - math.exp(-0.15 * hit_w)
        # Multi-domain motif bonus (catalog metadata)
        domain_bonus = min(0.12, 0.04 * len(core.domains))
        # Independence: 1 member = personal gold (low shared score); 3+ rises fast
        if mcount <= 0:
            shared_factor = 0.0
        elif mcount == 1:
            shared_factor = 0.28
        elif mcount == 2:
            shared_factor = 0.55
        elif mcount <= 4:
            shared_factor = 0.72
        else:
            shared_factor = min(1.0, 0.72 + 0.04 * (mcount - 4))

        coverage = mcount / n_mem
        score = min(
            1.0,
            shared_factor * (0.50 + 0.35 * min(1.0, mcount / 10) + 0.15 * volume)
            + domain_bonus * (1.0 if mcount >= 2 else 0.25)
            + 0.15 * min(1.0, coverage * 4),
        )

        rank_weight = 0.0 if score <= 0 else max(0.15, score)

        results.append(
            CoreScore(
                core_id=cid,
                label=core.label,
                direction=core.direction,
                member_count=mcount,
                members=members,
                hit_count=round(hit_w, 3),
                domains=list(core.domains),
                pair_hits=by_core_pair.get(cid, 0),
                member_source_hits=by_core_memsrc.get(cid, 0),
                score=round(score, 4),
                rank_weight=round(rank_weight, 4),
            )
        )

    results.sort(key=lambda s: (-s.score, -s.member_count, s.core_id))
    return results


# ── Train sampling ───────────────────────────────────────────────────────────

TIER_WEIGHTS: dict[str, float] = {
    "G0": 1.0,
    "G1": 0.95,
    "G2": 0.55,
    "G3": 0.45,
    "G4": 0.0,
}


def pair_core_boost(
    pair: dict[str, Any],
    core_scores: dict[str, CoreScore],
) -> float:
    """Multiplier from cores present in pair text / tags."""
    chosen = (pair.get("chosen") or {}).get("response") or ""
    prompt = pair.get("prompt") or ""
    ids = set(match_cores_in_text(f"{prompt}\n{chosen}"))
    for cid in pair.get("core_ids") or []:
        ids.add(str(cid))
    if not ids:
        return 1.0
    best = max(
        (core_scores[c].rank_weight for c in ids if c in core_scores),
        default=0.0,
    )
    # Up to +50% for sitting on a high-resonance core
    return 1.0 + 0.5 * best


def train_sample_weight(
    pair: dict[str, Any],
    core_scores: dict[str, CoreScore] | None = None,
) -> float:
    """P(pair) ∝ tier_weight × core_boost (GP-7 starter)."""
    tier = str(pair.get("provenance_tier") or "G0").upper()
    if pair.get("synthetic") is False and not pair.get("bootstrap"):
        tier = tier or "G0"
    base = TIER_WEIGHTS.get(tier, 0.5)
    if core_scores is None:
        return base
    return base * pair_core_boost(pair, core_scores)


# ── Report ───────────────────────────────────────────────────────────────────

def analyze_core_resonance(
    *,
    pairs_path: Path | None = None,
    councile_dir: Path | None = None,
    include_members: bool = True,
    include_pairs: bool = True,
) -> dict[str, Any]:
    root = councile_dir or default_councile_dir()
    members = load_members(root, load_bodies=True) if include_members else []
    pairs: list[dict[str, Any]] = []
    if include_pairs and pairs_path and pairs_path.is_file():
        pairs = load_pairs(pairs_path)

    hits: list[CoreHit] = []
    if include_members:
        hits.extend(collect_hits_from_members(members))
    if include_pairs:
        hits.extend(collect_hits_from_pairs(pairs))

    scores = score_cores(hits, total_members=max(1, len(members)))
    score_map = {s.core_id: s for s in scores}

    # Member × core matrix (binary)
    matrix: dict[str, list[str]] = {}
    for m in members:
        m_hits = sorted(
            {
                h.core_id
                for h in hits
                if h.member_id == m.member_id
            }
        )
        matrix[m.member_id] = m_hits

    # Pair weight stats (sample)
    weights: list[float] = []
    if pairs:
        for p in pairs:
            weights.append(train_sample_weight(p, score_map))

    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "catalog_version": "core-resonance-v1",
        "councile_dir": str(root),
        "pairs_source": str(pairs_path) if pairs_path else None,
        "member_count": len(members),
        "pair_count": len(pairs),
        "hit_count": len(hits),
        "cores": [
            {
                "core_id": s.core_id,
                "label": s.label,
                "direction": s.direction,
                "member_count": s.member_count,
                "members": s.members,
                "hit_count": s.hit_count,
                "domains": s.domains,
                "pair_hits": s.pair_hits,
                "member_source_hits": s.member_source_hits,
                "score": s.score,
                "rank_weight": s.rank_weight,
            }
            for s in scores
        ],
        "top_cores": [
            {"core_id": s.core_id, "score": s.score, "member_count": s.member_count}
            for s in scores
            if s.member_count >= 2
        ][:12],
        "member_core_matrix": matrix,
        "sample_weight": {
            "n": len(weights),
            "mean": round(sum(weights) / len(weights), 4) if weights else None,
            "min": round(min(weights), 4) if weights else None,
            "max": round(max(weights), 4) if weights else None,
        },
        "recommendations": _recommendations(scores, members, pairs),
    }
    return report


def _recommendations(
    scores: list[CoreScore],
    members: list[CouncilMember],
    pairs: list[dict[str, Any]],
) -> list[str]:
    recs: list[str] = []
    strong = [s for s in scores if s.member_count >= 3]
    weak = [s for s in scores if s.member_count == 0]
    thin = [s for s in scores if s.member_count == 1]
    if strong:
        recs.append(
            f"Upweight train samples on high-resonance cores: "
            + ", ".join(s.core_id for s in strong[:5])
        )
    if thin:
        recs.append(
            f"{len(thin)} cores seen in only one window — personal gold, not yet shared-core"
        )
    if weak:
        recs.append(
            f"{len(weak)} catalog cores have zero hits — deepen member-true G1 on those directions"
        )
    g1 = sum(1 for p in pairs if p.get("provenance_tier") == "G1")
    if g1 < max(50, len(members)):
        recs.append(
            f"G1 pairs ({g1}) still thin vs council roster ({len(members)}); "
            "run council-g1-generate from THE COUNCILE sources"
        )
    recs.append(
        "Shared-core score rewards multi-member recurrence; never collapse windows into one voice"
    )
    return recs


def render_core_resonance_md(report: dict[str, Any]) -> str:
    lines: list[str] = [
        "# Core Resonance report",
        "",
        f"- **Generated:** {report['generated_at']}",
        f"- **Council members:** {report['member_count']}",
        f"- **Pairs scanned:** {report['pair_count']}",
        f"- **Hits:** {report['hit_count']}",
        f"- **Catalog:** {report['catalog_version']}",
        "",
        "## Shared cores (ranked by Core Resonance Score)",
        "",
        "| Rank | Core | Score | Members | Hits | Domains |",
        "|-----:|------|------:|--------:|-----:|---------|",
    ]
    for i, c in enumerate(report["cores"], start=1):
        if c["score"] <= 0 and c["member_count"] == 0:
            continue
        domains = ", ".join(c["domains"]) if c["domains"] else "—"
        lines.append(
            f"| {i} | `{c['core_id']}` — {c['label']} | {c['score']:.3f} | "
            f"{c['member_count']} | {c['hit_count']} | {domains} |"
        )

    lines.extend(
        [
            "",
            "### Direction notes (top shared)",
            "",
        ]
    )
    for c in report["cores"]:
        if c["member_count"] < 2:
            continue
        lines.append(f"- **{c['label']}** (`{c['core_id']}`, score={c['score']:.3f})")
        lines.append(f"  - Direction: {c['direction']}")
        lines.append(f"  - Windows: {', '.join(c['members'][:12])}")
        lines.append("")

    lines.extend(
        [
            "## Plot (conceptual)",
            "",
            "```",
            "  high resonance",
            "       ^",
        ]
    )
    top = [c for c in report["cores"] if c["member_count"] >= 2][:8]
    max_s = max((c["score"] for c in top), default=1.0) or 1.0
    for c in top:
        bar = int(20 * c["score"] / max_s)
        lines.append(f"  {c['core_id'][:22]:22} |{'█' * bar}{' ' * (20 - bar)}| {c['score']:.2f}  n_mem={c['member_count']}")
    lines.extend(
        [
            "       +-----------------------> independent windows",
            "```",
            "",
            "## Train sampling (starter)",
            "",
            "```text",
            "P(pair) ∝ tier_weight[G0=1.0, G1=0.95, G2=0.55, G3=0.45] × (1 + 0.5 × best_core_rank_weight)",
            "```",
            "",
        ]
    )
    sw = report.get("sample_weight") or {}
    if sw.get("n"):
        lines.append(
            f"On this corpus: n={sw['n']} mean_weight={sw['mean']} "
            f"min={sw['min']} max={sw['max']}"
        )
        lines.append("")

    lines.extend(["## Recommendations", ""])
    for r in report.get("recommendations") or []:
        lines.append(f"- {r}")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("See `docs/gnosis-training/CORE_RESONANCE.md`.")
    lines.append("")
    return "\n".join(lines)


def run_core_resonance(
    pairs_path: Path | None = None,
    *,
    councile_dir: Path | None = None,
    out_dir: Path | None = None,
) -> dict[str, Any]:
    """Analyze + write logs/gnosis/core_resonance_*.{json,md}."""
    report = analyze_core_resonance(
        pairs_path=pairs_path,
        councile_dir=councile_dir,
    )
    if out_dir is None:
        # repo logs/gnosis
        here = Path(__file__).resolve()
        out_dir = here.parents[3] / "logs" / "gnosis"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    json_path = out_dir / f"core_resonance_{stamp}.json"
    md_path = out_dir / f"core_resonance_{stamp}.md"
    latest_json = out_dir / "core_resonance_latest.json"
    latest_md = out_dir / "core_resonance_latest.md"

    md = render_core_resonance_md(report)
    payload = json.dumps(report, indent=2, ensure_ascii=False)
    for p, content in (
        (json_path, payload),
        (latest_json, payload),
        (md_path, md),
        (latest_md, md),
    ):
        p.write_text(content, encoding="utf-8")

    report["outputs"] = {
        "json": str(json_path),
        "md": str(md_path),
        "latest_json": str(latest_json),
        "latest_md": str(latest_md),
    }
    return report
