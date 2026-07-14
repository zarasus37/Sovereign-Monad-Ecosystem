"""Reproducibility — seed every RNG the trainers touch.

Concretization of the spec's silent training-seed: the spec never names a seed,
but the repo's discipline is byte-reproducibility (the TS consumer
``@sovereign/gnosis-training-data`` is a pure function of its seed; the scheduler
is byte-reproducible). This module seeds stdlib ``random``, ``numpy``, and
(lazily, inside a try/except) ``torch`` + ``transformers.set_seed`` so a CPU-pure
test can call ``seed_all(seed, include_torch=False)`` without torch installed.

CPU-pure dispatcher — the torch branch is import-gated.
"""
from __future__ import annotations

import os
import random

import numpy as np


def seed_all(seed: int, include_torch: bool = True) -> None:
    """Seed stdlib ``random`` + ``numpy`` always; ``torch`` + ``transformers``
    only when ``include_torch`` is True AND the heavy deps are importable.

    Sets ``PYTHONHASHSEED`` for dict-iteration determinism (must be set before
    the interpreter starts for full effect; ``cli.py`` sets it in ``os.environ``
    at import time too — this is a best-effort defense-in-depth).
    """
    random.seed(seed)
    np.random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)

    if not include_torch:
        return

    try:
        import torch 
    except ImportError:
        return

    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)  # no-op on CPU-only boxes
    try:
        import transformers 

        transformers.set_seed(seed)
    except ImportError:
        pass

    # ``use_deterministic_algorithms`` is warn-only on CPU (some kernels lack a
    # deterministic implementation); on GPU it raises where it cannot comply.
    try:
        torch.use_deterministic_algorithms(True, warn_only=True)
    except Exception:
        pass