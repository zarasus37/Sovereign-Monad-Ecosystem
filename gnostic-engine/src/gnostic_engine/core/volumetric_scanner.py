"""
VolumetricScanner

The central 4D coherence engine. Combines SynapticWatcher, PulfrichWatcher,
and Stokes-Mueller mathematics into a unified volumetric scan.
"""

from __future__ import annotations
from typing import Dict, Any
import numpy as np
import json
from pathlib import Path

from ..utils.math import (
    stokes_vector,
    coherence_factor,
    structural_resonance,
    volumetric_coherence,
    resonance_index,
    mueller_matrix_linear_polarizer,
    mueller_matrix_retarder,
    apply_mueller_chain,
)
from .gnostic_engine import SynapticWatcher
from .pulfrich_watcher import PulfrichWatcher


class VolumetricScanner:
    """
    Performs 4D volumetric analysis on a variable stream.
    Produces structural_read, coherence, and verdict.
    """

    def __init__(self, var_id: str):
        self.var_id = var_id
        self.synaptic = SynapticWatcher()
        self.pulfrich = PulfrichWatcher(channel_a="primary", channel_b="secondary")
        self.last_scan: Dict[str, Any] | None = None
        # mapping manifest loaded lazily if present in repo
        self.mapping_manifest: Dict[str, Any] | None = None
        self._token_lookup: Dict[str, Dict[str, Any]] = {}
        self._load_mapping_manifest()

    def _load_mapping_manifest(self) -> None:
        """Search upward for archive/generated/notebooklm-manifest-export/mapping_manifest.json and load token lookup."""
        cur = Path(__file__).resolve()
        for parent in [cur.parent] + list(cur.parents):
            candidate = parent / 'archive' / 'generated' / 'notebooklm-manifest-export' / 'mapping_manifest.json'
            if candidate.exists():
                try:
                    with open(candidate, 'r', encoding='utf-8') as fh:
                        data = json.load(fh)
                    items = data.get('items') or data.get('files') or {}
                    # items expected to be mapping of relative_path -> info
                    for rel, info in items.items():
                        token = info.get('encoded_token') if isinstance(info, dict) else None
                        if token:
                            self._token_lookup[token] = {
                                'relative_path': rel,
                                'composite': info.get('composite') if isinstance(info, dict) else None,
                                'index': info.get('index') if isinstance(info, dict) else None,
                                'md5': info.get('md5') if isinstance(info, dict) else None,
                            }
                    self.mapping_manifest = data
                except Exception:
                    # ignore manifest load failures — leave lookup empty
                    self.mapping_manifest = None
                return

    def ingest(self, value: float, secondary_value: float | None = None, encoded_token: str | None = None) -> Dict[str, Any]:
        """Ingest a new observation and return volumetric analysis."""
        previous_history = self.synaptic.history.get(self.var_id, [])
        previous_value = previous_history[-1][1] if previous_history else value

        self.synaptic.track(self.var_id, value)
        self.pulfrich.track(self.var_id, value)
        if secondary_value is not None:
            self.pulfrich.track(f"{self.var_id}_secondary", secondary_value)

        primary_stokes = stokes_vector(abs(value), min(abs(value), 1.0), 0.12, 0.08)
        secondary_stokes = stokes_vector(
            abs(secondary_value) if secondary_value is not None else abs(previous_value),
            min(abs(secondary_value if secondary_value is not None else previous_value), 1.0),
            0.22,
            0.14,
        )
        reference_stokes = stokes_vector(abs(value + 0.05), min(abs(value - 0.05), 1.0), 0.18, 0.11)

        coherence = coherence_factor(primary_stokes, secondary_stokes)
        resonance = structural_resonance(primary_stokes, secondary_stokes)
        index = resonance_index(primary_stokes, secondary_stokes)
        volumetric = volumetric_coherence([primary_stokes, secondary_stokes, reference_stokes])

        polarizer = mueller_matrix_linear_polarizer(0.35)
        retarder = mueller_matrix_retarder(delta=0.45, theta=0.18)
        mueller_output = apply_mueller_chain(primary_stokes, polarizer, retarder)
        mueller_energy = float(np.linalg.norm(mueller_output))

        phase_tilt = self.pulfrich.get_elliptical_parallax(self.var_id)

        result = {
            "var_id": self.var_id,
            "structural_read": round(coherence, 4),
            "resonance": round(resonance, 4),
            "resonance_index": round(index, 4),
            "volumetric_coherence": round(volumetric, 4),
            "mueller_chain_energy": round(mueller_energy, 4),
            "phase_tilt": round(phase_tilt, 2),
            "verdict": "coherent" if resonance > 0.7 and coherence > 0.65 else "decoherent",
        }
        # If an encoded token is supplied, attempt to resolve it via the manifest
        if encoded_token is not None:
            mapped = self._token_lookup.get(encoded_token)
            result['mapped_file'] = mapped if mapped is not None else None

        self.last_scan = result
        return result

    def get_last_scan(self) -> Dict[str, Any] | None:
        return self.last_scan
