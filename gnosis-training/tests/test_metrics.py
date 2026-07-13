"""metrics.py — eval math (CPU-pure, numpy only)."""
from __future__ import annotations

import pytest

from gnosis_training.metrics import (
    consistency_check,
    deterministic_shuffle,
    domain_presence,
    mae,
    per_criterion_agreement,
    r2_score,
    rmse,
    score_regression_metrics,
    tripartite_coverage,
)


def test_mae_zero_on_identical_arrays():
    assert mae([0.5, 0.3], [0.5, 0.3]) == 0.0


def test_mae_mean_absolute_error():
    assert mae([1.0, 0.0], [0.0, 1.0]) == pytest.approx(1.0)


def test_rmse_known_value():
    assert rmse([1.0, 2.0], [1.0, 2.0]) == 0.0
    assert rmse([0.0], [1.0]) == pytest.approx(1.0)


def test_r2_perfect_is_one():
    assert r2_score([1, 2, 3], [1, 2, 3]) == pytest.approx(1.0)


def test_r2_predict_mean_is_zero():
    """Predicting the held-out mean → R² = 0."""
    h = [1.0, 2.0, 3.0]
    mean = sum(h) / len(h)
    assert r2_score([mean, mean, mean], h) == pytest.approx(0.0)


def test_r2_single_sample_is_zero():
    """R² is undefined on a single sample; the helper returns 0.0."""
    assert r2_score([0.5], [0.5]) == 0.0


def test_score_regression_metrics_has_all_criteria_and_total():
    predicted = [{"tripartite": 1.0, "logic_compress": 0.9, "source_aligned": 1.0,
                  "epistemic": 0.8, "no_rlhf_signal": 1.0, "total": 0.95}]
    held = [{"tripartite": 0.9, "logic_compress": 0.9, "source_aligned": 1.0,
             "epistemic": 0.8, "no_rlhf_signal": 1.0, "total": 0.90}]
    out = score_regression_metrics(predicted, held)
    for name in ("tripartite", "logic_compress", "source_aligned", "epistemic",
                "no_rlhf_signal", "total"):
        assert name in out
        assert set(out[name]) == {"mae", "rmse", "r2"}


def test_per_criterion_agreement_counts_tolerance_hits():
    predicted = [{"tripartite": 1.0, "logic_compress": 0.9, "source_aligned": 1.0,
                  "epistemic": 0.8, "no_rlhf_signal": 1.0, "total": 0.95}]
    held = [{"tripartite": 0.95, "logic_compress": 0.85, "source_aligned": 1.0,
             "epistemic": 0.8, "no_rlhf_signal": 1.0, "total": 0.92}]
    # all 6 within 0.10 tolerance → 1.0
    assert per_criterion_agreement(predicted, held, tolerance=0.10) == 1.0


def test_domain_presence_flags_each_domain():
    response = ("The theological origin and the technological mechanism meet at "
                "the cosmological scale of civilizations.")
    presence = domain_presence(response)
    assert presence["theology"] is True
    assert presence["technology"] is True
    assert presence["cosmology"] is True


def test_domain_presence_missing_domain():
    response = "The mechanism is efficient."  # technology only
    presence = domain_presence(response)
    assert presence["technology"] is True
    assert presence["theology"] is False
    assert presence["cosmology"] is False


def test_tripartite_coverage_full_and_partial():
    full = ("theological origin technological mechanism cosmological scale")
    partial = "technological mechanism only"
    cov = tripartite_coverage([full, partial])
    assert cov["coverage"] == pytest.approx(0.5)
    assert cov["missing_rate"] == pytest.approx(0.5)


def test_consistency_check_returns_tripartite_coverage():
    out = consistency_check(["theological technological cosmological"])
    assert out["tripartite_coverage"] == 1.0


def test_deterministic_shuffle_is_seed_stable():
    """Same seed → same order (repo byte-reproducibility discipline)."""
    items = list(range(20))
    a = deterministic_shuffle(items, seed=42)
    b = deterministic_shuffle(items, seed=42)
    assert a == b


def test_deterministic_shuffle_different_seed_differs():
    items = list(range(20))
    a = deterministic_shuffle(items, seed=42)
    b = deterministic_shuffle(items, seed=99)
    assert a != b


def test_mae_length_mismatch_raises():
    with pytest.raises(ValueError):
        mae([1.0], [1.0, 2.0])