"""
Stokes-Mueller Polarization Filters
Computes 4D polarization metrics (Stokes vector, Mueller matrices, phase coherence).
"""

import numpy as np


class PolarizationFilter:
    """
    Implements Stokes-Mueller 4D polarization analysis.
    Measures coherence (DoP), phase alignment, and elliptical state.
    """

    @staticmethod
    def stokes_vector(intensity: float, dop: float, azimuth: float, ellipticity: float) -> np.ndarray:
        """
        Create a normalized Stokes vector from polarization parameters.
        S0: total intensity
        S1, S2: linear polarization
        S3: circular polarization
        """
        s0 = intensity
        s1 = dop * s0 * np.cos(2 * azimuth)
        s2 = dop * s0 * np.sin(2 * azimuth)
        s3 = dop * s0 * np.sin(2 * ellipticity)
        return np.array([s0, s1, s2, s3])

    @staticmethod
    def mueller_matrix_linear_polarizer(angle: float) -> np.ndarray:
        """Mueller matrix for linear polarizer at given angle."""
        c = np.cos(2 * angle)
        s = np.sin(2 * angle)
        return 0.5 * np.array([
            [1, c, s, 0],
            [c, c**2, c*s, 0],
            [s, c*s, s**2, 0],
            [0, 0, 0, 0]
        ])

    @staticmethod
    def coherence_factor(s1: np.ndarray, s2: np.ndarray) -> float:
        """Compute coherence (dot product normalized)."""
        denom = np.linalg.norm(s1) * np.linalg.norm(s2)
        if denom < 1e-12:
            return 0.0
        return float(np.dot(s1, s2) / denom)

    def compute_phase_coherence(self, signal_a: np.ndarray, signal_b: np.ndarray) -> float:
        """
        Compute instantaneous phase coherence between two signals.
        Returns value in [0, 1] where 1.0 = perfect coherence.
        """
        coherence = self.coherence_factor(signal_a, signal_b)
        return np.clip(coherence, 0.0, 1.0)

    def compute_circular_ellipticity(self, stokes: np.ndarray) -> float:
        """
        Compute degree of circular polarization (S3/S0).
        High value = circular; low value = linear.
        """
        s0 = stokes[0]
        s3 = stokes[3]
        if s0 < 1e-12:
            return 0.0
        return float(np.abs(s3) / s0)
