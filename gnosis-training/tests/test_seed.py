"""seed.py — reproducibility (CPU-pure; torch branch import-gated)."""
from __future__ import annotations

import random

import numpy as np

from gnosis_training.seed import seed_all


def test_seed_all_seeds_stdlib_random():
    """seed_all(42, include_torch=False) makes stdlib random deterministic."""
    seed_all(42, include_torch=False)
    a = [random.random() for _ in range(5)]
    seed_all(42, include_torch=False)
    b = [random.random() for _ in range(5)]
    assert a == b


def test_seed_all_seeds_numpy():
    """seed_all(42, include_torch=False) makes numpy deterministic."""
    seed_all(42, include_torch=False)
    a = np.random.random(5)
    seed_all(42, include_torch=False)
    b = np.random.random(5)
    assert np.array_equal(a, b)


def test_seed_all_different_seed_differs():
    """Different seed → different numpy sequence (non-degenerate)."""
    seed_all(42, include_torch=False)
    a = np.random.random(5)
    seed_all(99, include_torch=False)
    b = np.random.random(5)
    assert not np.array_equal(a, b)


def test_seed_all_sets_pythonhashseed():
    """PYTHONHASHSEED is set for dict-iteration determinism."""
    import os

    seed_all(7, include_torch=False)
    assert os.environ.get("PYTHONHASHSEED") == "7"


def test_seed_all_torch_branch_is_safe_without_torch():
    """include_torch=True must NOT raise when torch is absent — it silently
    skips the torch/transformers branches (CPU-pure box)."""
    seed_all(42, include_torch=True)  # no raise whether or not torch is installed