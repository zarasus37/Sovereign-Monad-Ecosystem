"""
Gnostic Engine — Volumetric 4D Gnostic Processing Engine

Core components for the Sovereign Monad Ecosystem.
"""

from .core.gnostic_engine import SynapticWatcher
from .core.pulfrich_watcher import PulfrichWatcher
from .core.volumetric_scanner import VolumetricScanner
from .foraging.market_forager import forage_market_truth
from .utils.math import (
    stokes_vector,
    coherence_factor,
    mueller_matrix_linear_polarizer,
    mueller_matrix_retarder,
    apply_mueller_chain,
    structural_resonance,
    volumetric_coherence,
    resonance_index,
    mueller_resonance_score,
)

__all__ = [
    "SynapticWatcher",
    "PulfrichWatcher",
    "VolumetricScanner",
    "forage_market_truth",
    "stokes_vector",
    "coherence_factor",
    "mueller_matrix_linear_polarizer",
    "mueller_matrix_retarder",
    "apply_mueller_chain",
    "structural_resonance",
    "volumetric_coherence",
    "resonance_index",
    "mueller_resonance_score",
]

__version__ = "0.1.0"