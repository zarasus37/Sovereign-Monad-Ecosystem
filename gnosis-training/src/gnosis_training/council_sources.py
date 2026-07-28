"""Load Council of Reflection registry + member source texts.

Source of truth: ``theo-techno-cosmo/THE COUNCILE/council-registry.json``
and the member files listed in each entry's ``source_files``.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable


def default_councile_dir(repo_root: Path | None = None) -> Path:
    """Resolve THE COUNCILE directory from common working directories."""
    if repo_root is not None:
        p = repo_root / "theo-techno-cosmo" / "THE COUNCILE"
        if p.is_dir():
            return p
    here = Path(__file__).resolve()
    # gnosis-training/src/gnosis_training → repo root is parents[3]
    candidates = [
        here.parents[3] / "theo-techno-cosmo" / "THE COUNCILE",
        Path.cwd() / "theo-techno-cosmo" / "THE COUNCILE",
        Path.cwd().parent / "theo-techno-cosmo" / "THE COUNCILE",
    ]
    for c in candidates:
        if c.is_dir():
            return c
    return candidates[0]


@dataclass(frozen=True)
class CouncilMember:
    """One Council of Reflection member from the registry."""

    member_id: str
    display_name: str
    era: str
    status: str
    ttc_emphasis: tuple[str, ...]
    contribution: str
    key_insight: str
    source_files: tuple[str, ...]
    recently_added: bool = False
    notes: str | None = None
    source_dir: Path | None = None
    body_excerpts: tuple[str, ...] = field(default_factory=tuple)

    @property
    def window_text(self) -> str:
        """Compact member viewpoint for generation / matching."""
        parts = [
            f"{self.display_name} ({self.era})",
            self.key_insight,
            self.contribution,
        ]
        parts.extend(self.body_excerpts)
        return "\n\n".join(p for p in parts if p and p.strip())


def load_registry(councile_dir: Path | None = None) -> dict[str, Any]:
    root = councile_dir or default_councile_dir()
    path = root / "council-registry.json"
    if not path.is_file():
        raise FileNotFoundError(f"council registry not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _excerpt_file(path: Path, *, max_chars: int = 1800) -> str:
    if not path.is_file():
        return ""
    raw = path.read_text(encoding="utf-8", errors="replace")
    # Prefer denser mid-file if front matter is long titles
    cleaned = re.sub(r"\r\n?", "\n", raw)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    if len(cleaned) <= max_chars:
        return cleaned
    # Take head + a mid slice for gnosis density
    head = cleaned[: max_chars // 2]
    mid_start = max(0, len(cleaned) // 3)
    mid = cleaned[mid_start : mid_start + max_chars // 2]
    return (head + "\n…\n" + mid)[: max_chars + 20]


def load_members(
    councile_dir: Path | None = None,
    *,
    status: str | None = "active",
    load_bodies: bool = True,
    max_excerpt_chars: int = 1600,
) -> list[CouncilMember]:
    """Load members; optionally pull short excerpts from source files."""
    root = councile_dir or default_councile_dir()
    reg = load_registry(root)
    out: list[CouncilMember] = []
    for m in reg.get("members") or []:
        if status and str(m.get("status", "active")) != status:
            continue
        files = tuple(str(f) for f in (m.get("source_files") or []))
        excerpts: list[str] = []
        if load_bodies:
            for fname in files:
                p = root / fname
                ex = _excerpt_file(p, max_chars=max_excerpt_chars)
                if ex:
                    excerpts.append(ex)
        out.append(
            CouncilMember(
                member_id=str(m["member_id"]),
                display_name=str(m.get("display_name") or m["member_id"]),
                era=str(m.get("era") or ""),
                status=str(m.get("status") or "active"),
                ttc_emphasis=tuple(str(x) for x in (m.get("ttc_emphasis") or [])),
                contribution=str(m.get("contribution") or ""),
                key_insight=str(m.get("key_insight") or ""),
                source_files=files,
                recently_added=bool(m.get("recently_added", False)),
                notes=m.get("notes"),
                source_dir=root,
                body_excerpts=tuple(excerpts),
            )
        )
    return out


def member_by_id(
    members: Iterable[CouncilMember], member_id: str
) -> CouncilMember | None:
    mid = member_id.lower().strip()
    for m in members:
        if m.member_id.lower() == mid:
            return m
    return None


def generator_member_id(generator: str | None) -> str | None:
    """Parse ``council:sun-tzu`` → ``sun-tzu``."""
    if not generator:
        return None
    g = generator.strip().lower()
    if g.startswith("council:"):
        return g.split(":", 1)[1].strip() or None
    return None
