"""
LOGOC Peirce Manifold
Loads canonical 66-class table from spec/peirce_sign_classes.json.
Single source of truth shared with the TypeScript mirror.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Literal

from ._numerics import (
    WEIGHT_RING,
    WEIGHT_ANGLE,
    WEIGHT_HAMMING,
    MAX_DISTANCE,
)

PragmatismBand = Literal["INSTINCT", "EXPERIENCE", "FORMAL_THOUGHT"]

_SPEC_PATH = Path(__file__).parent.parent / "spec" / "peirce_sign_classes.json"


@dataclass(frozen=True)
class PeirceSignClass:
    id: int
    label: str
    path: List[str]
    firstness_weight: float
    secondness_weight: float
    thirdness_weight: float
    pragmatism_band: PragmatismBand
    ring_radius: int
    ring_angle_deg: float


class PeirceManifold:
    """
    Canonical Peirce 66-class manifold with geometry-aware distance metrics.

    Distance metric:
        d(a,b) = w_r * |ring_radius_a - ring_radius_b|
               + w_a * angular_delta(a, b) / 360.0
               + w_h * hamming(path_a, path_b)
    where angular_delta is the shorter arc distance in [0, 180].

    The weights (w_r, w_a, w_h) and the default neighbor radius are imported
    from `._numerics` (generated from shared/schemas/ttcl-numerics.json —
    Layer 4a single source of truth).
    """

    def __init__(self, spec_path: Path = _SPEC_PATH):
        raw = json.loads(spec_path.read_text(encoding="utf-8"))
        classes = [PeirceSignClass(**entry) for entry in raw]
        self._by_id: Dict[int, PeirceSignClass] = {c.id: c for c in classes}
        self._by_label: Dict[str, int] = {c.label: c.id for c in classes}
        self._by_path: Dict[str, int] = {self._path_key(c.path): c.id for c in classes}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get(self, class_id: int) -> PeirceSignClass:
        if class_id not in self._by_id:
            raise KeyError(f"Unknown Peirce class ID: {class_id}")
        return self._by_id[class_id]

    def has_path(self, path: List[str]) -> bool:
        """Return True if the exact path exists in the manifold."""
        key = self._path_key(path)
        return key in self._by_path

    def lookup_by_path(self, path: List[str]) -> PeirceSignClass:
        key = self._path_key(path)
        if key in self._by_path:
            return self.get(self._by_path[key])
        # Prefix match: accept partial path (e.g., ["Legisign", "Symbol"])
        for full_key, cid in self._by_path.items():
            if full_key.startswith(key):
                return self.get(cid)
        raise ValueError(f"No sign class found for path: {path}")

    def in_band(self, band: PragmatismBand) -> List[PeirceSignClass]:
        return [c for c in self._by_id.values() if c.pragmatism_band == band]

    def distance(self, a_id: int, b_id: int) -> float:
        """
        Composite manifold distance between two sign classes:
        weighted sum of ring radius diff, angular arc diff, and path Hamming distance.
        Returns a float in [0, ~1.7] (not normalised to 1 to preserve interpretability).
        """
        a = self.get(a_id)
        b = self.get(b_id)

        ring_delta = abs(a.ring_radius - b.ring_radius)

        # Angular arc distance: shorter of the two arcs (0–180°)
        angle_diff = abs(a.ring_angle_deg - b.ring_angle_deg)
        angular_delta = min(angle_diff, 360.0 - angle_diff) / 180.0

        hamming = sum(1 for x, y in zip(a.path, b.path) if x != y)

        return (
            WEIGHT_RING * ring_delta
            + WEIGHT_ANGLE * angular_delta
            + WEIGHT_HAMMING * hamming
        )

    def neighbors(self, class_id: int, max_distance: float = MAX_DISTANCE) -> List[PeirceSignClass]:
        """Return all sign classes within `max_distance` of the given class."""
        return [
            c for cid, c in self._by_id.items()
            if cid != class_id and self.distance(class_id, cid) <= max_distance
        ]

    def all_classes(self) -> List[PeirceSignClass]:
        return list(self._by_id.values())

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _path_key(path: List[str]) -> str:
        return "|".join(path)


# Module-level singleton
_manifold: PeirceManifold | None = None


def get_manifold() -> PeirceManifold:
    global _manifold
    if _manifold is None:
        _manifold = PeirceManifold()
    return _manifold
