"""Load versioned, immutable TTC constraint packs from ``shared/constraints/``.

Pack layout::

    shared/constraints/
      CURRENT                 # e.g. "1.0.0"
      v1.0.0/
        manifest.json
        theological.json
        technological.json
        cosmological.json

Once shipped, a version directory is immutable (governance via new versions only).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional


def _repo_root_from_here() -> Path:
    # .../gnostic-engine/src/gnostic_engine/constraints/loader.py → repo root
    return Path(__file__).resolve().parents[4]


def constraints_root(repo_root: Optional[Path] = None) -> Path:
    root = repo_root or _repo_root_from_here()
    return root / "shared" / "constraints"


def read_current_version(repo_root: Optional[Path] = None) -> str:
    path = constraints_root(repo_root) / "CURRENT"
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        raise FileNotFoundError(f"Empty CURRENT pointer at {path}")
    return text


@dataclass(frozen=True)
class ConstraintRule:
    id: str
    name: str
    severity: str
    description: str
    params: Dict[str, Any]


@dataclass(frozen=True)
class DomainPack:
    version: str
    domain: str
    principle: str
    operational_question: str
    failure_mode: str
    immutable: bool
    rules: List[ConstraintRule]


@dataclass(frozen=True)
class ConstraintPack:
    version: str
    manifest: Dict[str, Any]
    theological: DomainPack
    technological: DomainPack
    cosmological: DomainPack

    def known_versions(self) -> List[str]:
        tech = self.technological
        for rule in tech.rules:
            if rule.id == "X-VERSIONED-CONSTRAINTS":
                known = rule.params.get("known_versions")
                if isinstance(known, list):
                    return [str(v) for v in known]
        return [self.version]


def _load_json(path: Path) -> Dict[str, Any]:
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"Expected object JSON at {path}")
    return data


def _parse_domain(data: Dict[str, Any]) -> DomainPack:
    rules: List[ConstraintRule] = []
    for raw in data.get("rules", []):
        rules.append(
            ConstraintRule(
                id=str(raw["id"]),
                name=str(raw.get("name", raw["id"])),
                severity=str(raw.get("severity", "hard")),
                description=str(raw.get("description", "")),
                params=dict(raw.get("params") or {}),
            )
        )
    return DomainPack(
        version=str(data["version"]),
        domain=str(data["domain"]),
        principle=str(data.get("principle", "")),
        operational_question=str(data.get("operational_question", "")),
        failure_mode=str(data.get("failure_mode", "")),
        immutable=bool(data.get("immutable", True)),
        rules=rules,
    )


def load_constraint_pack(
    version: Optional[str] = None,
    repo_root: Optional[Path] = None,
) -> ConstraintPack:
    """Load a constraint pack by version (default: ``CURRENT``)."""
    root = constraints_root(repo_root)
    ver = version or read_current_version(repo_root)
    pack_dir = root / f"v{ver}"
    if not pack_dir.is_dir():
        raise FileNotFoundError(f"Constraint pack not found: {pack_dir}")

    manifest = _load_json(pack_dir / "manifest.json")
    theo = _parse_domain(_load_json(pack_dir / "theological.json"))
    tech = _parse_domain(_load_json(pack_dir / "technological.json"))
    cosmo = _parse_domain(_load_json(pack_dir / "cosmological.json"))

    for domain_pack in (theo, tech, cosmo):
        if domain_pack.version != ver:
            raise ValueError(
                f"Domain {domain_pack.domain} version {domain_pack.version} "
                f"!= pack version {ver}"
            )

    return ConstraintPack(
        version=ver,
        manifest=manifest,
        theological=theo,
        technological=tech,
        cosmological=cosmo,
    )


@lru_cache(maxsize=8)
def get_constraint_pack(version: Optional[str] = None) -> ConstraintPack:
    """Cached pack load (process-local). Pass explicit version for tests."""
    return load_constraint_pack(version=version)
