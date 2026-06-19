"""
Stokes-Mueller and Volumetric Math Utilities

Core mathematical helpers for 4D coherence analysis.
"""

from __future__ import annotations
import numpy as np


def stokes_vector(intensity: float, dop: float, azimuth: float, ellipticity: float) -> np.ndarray:
    """
    Create a normalized Stokes vector.
    dop = Degree of Polarization (0-1)
    """
    s0 = intensity
    s1 = dop * s0 * np.cos(2 * azimuth) * np.cos(2 * ellipticity)
    s2 = dop * s0 * np.sin(2 * azimuth) * np.cos(2 * ellipticity)
    s3 = dop * s0 * np.sin(2 * ellipticity)
    return np.array([s0, s1, s2, s3])


def mueller_matrix_rotation(theta: float) -> np.ndarray:
    """Rotation Mueller matrix."""
    c = np.cos(2 * theta)
    s = np.sin(2 * theta)
    return np.array([
        [1, 0, 0, 0],
        [0, c, s, 0],
        [0, -s, c, 0],
        [0, 0, 0, 1]
    ])


def coherence_factor(s1: np.ndarray, s2: np.ndarray) -> float:
    """Simple coherence metric between two Stokes vectors."""
    return float(np.dot(s1, s2) / (np.linalg.norm(s1) * np.linalg.norm(s2) + 1e-12))


def phase_difference(s1: np.ndarray, s2: np.ndarray) -> float:
    """Compute the angular phase difference between two Stokes vectors."""
    denom = np.linalg.norm(s1) * np.linalg.norm(s2) + 1e-12
    value = np.clip(np.dot(s1, s2) / denom, -1.0, 1.0)
    return float(np.arccos(value))


def stokes_similarity(s1: np.ndarray, s2: np.ndarray) -> float:
    """Normalized similarity measure for Stokes vectors."""
    return float(1.0 - np.linalg.norm(s1 - s2) / (np.linalg.norm(s1) + np.linalg.norm(s2) + 1e-12))


def coherence_matrix(s_list: list[np.ndarray]) -> np.ndarray:
    """Pairwise coherence matrix for a set of Stokes vectors."""
    size = len(s_list)
    matrix = np.zeros((size, size), dtype=float)
    for i in range(size):
        for j in range(size):
            matrix[i, j] = coherence_factor(s_list[i], s_list[j])
    return matrix


# ─────────────────────────────────────────────────────────────
# Advanced 4D Mueller Matrix Operations
# ─────────────────────────────────────────────────────────────

def mueller_matrix_linear_polarizer(angle: float) -> np.ndarray:
    """Linear polarizer Mueller matrix at given angle (radians)."""
    c = np.cos(2 * angle)
    s = np.sin(2 * angle)
    return 0.5 * np.array([
        [1, c, s, 0],
        [c, c**2, c*s, 0],
        [s, c*s, s**2, 0],
        [0, 0, 0, 0]
    ])


def mueller_matrix_retarder(delta: float, theta: float = 0.0) -> np.ndarray:
    """Retarder (waveplate) Mueller matrix."""
    c = np.cos(2 * theta)
    s = np.sin(2 * theta)
    cd = np.cos(delta)
    sd = np.sin(delta)
    return np.array([
        [1, 0, 0, 0],
        [0, c**2 + s**2*cd, c*s*(1-cd), -s*sd],
        [0, c*s*(1-cd), s**2 + c**2*cd, c*sd],
        [0, s*sd, -c*sd, cd]
    ])


def apply_mueller_chain(stokes: np.ndarray, *matrices: np.ndarray) -> np.ndarray:
    """Apply a chain of Mueller matrices to a Stokes vector."""
    result = stokes.copy()
    for m in matrices:
        result = m @ result
    return result


def structural_resonance(s1: np.ndarray, s2: np.ndarray, alpha: float = 0.6) -> float:
    """
    Structural resonance score combining coherence, phase alignment, and polarization similarity.
    Higher = more 'structurally resonant'.
    """
    coh = coherence_factor(s1, s2)
    phase_align = np.abs(np.dot(s1[1:], s2[1:])) / (
        np.linalg.norm(s1[1:]) * np.linalg.norm(s2[1:]) + 1e-12
    )
    similarity = stokes_similarity(s1, s2)
    return float(alpha * coh + (1 - alpha) * phase_align * similarity)


def volumetric_coherence(s_list: list[np.ndarray], weights: list[float] | None = None) -> float:
    """
    Multi-vector volumetric coherence across several Stokes vectors.
    Returns a weighted average of pairwise coherence values.
    """
    if not s_list:
        return 0.0
    if weights is None:
        weights = [1.0] * len(s_list)
    if len(s_list) == 1:
        return 1.0

    total = 0.0
    weight_sum = 0.0
    for i in range(len(s_list)):
        for j in range(i + 1, len(s_list)):
            pair_weight = weights[i] * weights[j]
            total += coherence_factor(s_list[i], s_list[j]) * pair_weight
            weight_sum += pair_weight

    return float(total / weight_sum) if weight_sum > 0 else 0.0


def resonance_index(s1: np.ndarray, s2: np.ndarray, beta: float = 0.4) -> float:
    """
    Advanced resonance index that includes magnitude, phase, and polarization alignment.
    """
    norm1 = np.linalg.norm(s1)
    norm2 = np.linalg.norm(s2)
    mag = 1 - abs(norm1 - norm2) / (norm1 + norm2 + 1e-9)
    phase = np.abs(np.vdot(s1[1:], s2[1:])) / (
        np.linalg.norm(s1[1:]) * np.linalg.norm(s2[1:]) + 1e-9
    )
    coh = coherence_factor(s1, s2)
    return float(beta * mag + (1 - beta) * (0.5 * phase + 0.5 * coh))


def mueller_resonance_score(
    s1: np.ndarray,
    s2: np.ndarray,
    polarizer_angle: float = 0.25,
    retarder_delta: float = 0.45,
    retarder_theta: float = 0.1,
) -> float:
    """Estimate resonance after applying a Mueller polarizer-retarder chain."""
    chain_output = apply_mueller_chain(
        s1,
        mueller_matrix_linear_polarizer(polarizer_angle),
        mueller_matrix_retarder(retarder_delta, retarder_theta),
    )
    return coherence_factor(chain_output, s2)
