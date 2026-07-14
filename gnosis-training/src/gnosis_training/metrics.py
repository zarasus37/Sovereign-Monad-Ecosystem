"""Evaluation metrics — the CPU-pure math behind the eval battery (spec line
307-310: constitution score regression, consistency checks, theo/techno/cosmo
coherence).

The model LOAD stays in ``eval.py`` (import-gated); this module does only the
pure scoring math on numeric arrays / response strings, so it is unit-testable
without torch. The coherence checks here are deterministic LEXICAL PROXIES (does
the response name each domain?), NOT a model — the spec's "coherence tests" are
concretized as presence + balance proxies until a real semantic judge exists.
"""
from __future__ import annotations

import math
from typing import Any, Sequence

import numpy as np

# ── Score regression (reward model tracks the constitution scorer?) ──────────
_CRITERION_NAMES = (
    "tripartite",
    "logic_compress",
    "source_aligned",
    "epistemic",
    "no_rlhf_signal",
    "total",
)


def _mean(xs: Sequence[float]) -> float:
    return float(sum(xs) / len(xs)) if xs else 0.0


def mae(predicted: Sequence[float], held_out: Sequence[float]) -> float:
    """Mean absolute error between predicted and held-out score arrays."""
    if len(predicted) != len(held_out):
        raise ValueError(f"length mismatch: {len(predicted)} vs {len(held_out)}")
    if not predicted:
        return 0.0
    return _mean([abs(p - h) for p, h in zip(predicted, held_out)])


def rmse(predicted: Sequence[float], held_out: Sequence[float]) -> float:
    """Root mean squared error."""
    if len(predicted) != len(held_out):
        raise ValueError(f"length mismatch: {len(predicted)} vs {len(held_out)}")
    if not predicted:
        return 0.0
    return math.sqrt(_mean([(p - h) ** 2 for p, h in zip(predicted, held_out)]))


def r2_score(predicted: Sequence[float], held_out: Sequence[float]) -> float:
    """Coefficient of determination R² (1.0 = perfect, 0.0 = predict-the-mean,
    negative = worse than the mean). Returns 0.0 on a single sample or
    zero-variance held-out (R² is undefined there)."""
    if len(predicted) != len(held_out):
        raise ValueError(f"length mismatch: {len(predicted)} vs {len(held_out)}")
    if len(predicted) < 2:
        return 0.0
    mean_h = _mean(held_out)
    ss_res = sum((p - h) ** 2 for p, h in zip(predicted, held_out))
    ss_tot = sum((h - mean_h) ** 2 for h in held_out)
    if ss_tot == 0.0:
        return 0.0
    return float(1.0 - ss_res / ss_tot)


def score_regression_metrics(
    predicted: Sequence[dict[str, float]],
    held_out: Sequence[dict[str, float]],
) -> dict[str, dict[str, float]]:
    """Per-criterion + total regression metrics (MAE, RMSE, R²).

    Each input is a list of score dicts shaped like ``ConstitutionScore`` (keys:
    the 5 criteria + ``total``). Returns ``{criterion: {mae, rmse, r2}}``.
    """
    if len(predicted) != len(held_out):
        raise ValueError(f"length mismatch: {len(predicted)} vs {len(held_out)}")

    out: dict[str, dict[str, float]] = {}
    for name in _CRITERION_NAMES:
        p = [float(row[name]) for row in predicted]
        h = [float(row[name]) for row in held_out]
        out[name] = {"mae": mae(p, h), "rmse": rmse(p, h), "r2": r2_score(p, h)}
    return out


def per_criterion_agreement(
    predicted: Sequence[dict[str, float]],
    held_out: Sequence[dict[str, float]],
    tolerance: float = 0.10,
) -> float:
    """Fraction of (sample, criterion) pairs where |predicted - held_out| <=
    tolerance. A coarse "the reward model agrees with the constitution scorer
    per criterion" signal used by the eval battery."""
    if not predicted or len(predicted) != len(held_out):
        raise ValueError("equal non-empty sequences required")
    total = 0
    agree = 0
    for p_row, h_row in zip(predicted, held_out):
        for name in _CRITERION_NAMES:
            total += 1
            if abs(float(p_row[name]) - float(h_row[name])) <= tolerance:
                agree += 1
    return float(agree / total) if total else 0.0


# ── Coherence proxies (theo / techno / cosmo presence — NOT a model) ────────
_DOMAIN_LEXICONS: dict[str, tuple[str, ...]] = {
    "theology": (
        "theolog", "divine", "sacred", "spirit", "god", "origin", "pattern",
        "soul", "transcend",
    ),
    "technology": (
        "technolog", "mechanism", "system", "cause", "effect", "process",
        "structure", "function", "engineering",
    ),
    "cosmology": (
        "cosmolog", "scale", "emergence", "time", "epoch", "universal", "arc",
        "entropy", "civilization",
    ),
}


def domain_presence(response: str) -> dict[str, bool]:
    """Lexical presence proxy: does ``response`` mention each domain's
    vocabulary? Coarse and deterministic — the spec's "coherence tests"
    concretized as a presence gate, NOT a semantic judge."""
    text = response.lower()
    return {
        domain: any(token in text for token in tokens)
        for domain, tokens in _DOMAIN_LEXICONS.items()
    }


def tripartite_coverage(responses: Sequence[str]) -> dict[str, float]:
    """Fraction of responses that mention ALL three domains (a coherence
    proxy for the spec's "theological/technical/cosmological coherence tests").
    Returns ``{coverage, missing_rate}``."""
    if not responses:
        return {"coverage": 0.0, "missing_rate": 1.0}
    full = 0
    missing_any = 0
    for r in responses:
        presence = domain_presence(r)
        if all(presence.values()):
            full += 1
        if not all(presence.values()):
            missing_any += 1
    n = len(responses)
    return {"coverage": full / n, "missing_rate": missing_any / n}


def consistency_check(responses: Sequence[str]) -> dict[str, float]:
    """Deterministic consistency proxy: the fraction of responses that pass the
    tripartite-coverage gate. (The spec's "consistency checks" are concretized
    as the same presence proxy across a response set — does the model reliably
    surface all three domains?)"""
    cov = tripartite_coverage(responses)
    return {"tripartite_coverage": cov["coverage"]}


# ── Numpy-backed helpers (deterministic shuffle for eval sampling) ──────────
def deterministic_shuffle(items: list[Any], seed: int) -> list[Any]:
    """Return a deterministically shuffled copy of ``items`` (numpy-seeded).
    Mirrors the repo's determinism discipline — no ``random.random`` / wall-clock."""
    arr = np.array(list(items), dtype=object)
    rng = np.random.default_rng(seed)
    idx = rng.permutation(len(arr))
    return [arr[i] for i in idx]