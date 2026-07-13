"""TTCL Layer 7 Training Pipeline (SFT→Reward→PPO→Eval).

Real TRL wiring (SFTTrainer / RewardTrainer / PPOTrainer + QLoRA), import-smoke
verified. NO training is executed in this package by default — the LLaMA 3.1 8B
run is an explicitly-future GPU job. See README.md for the honesty posture.

This top-level import is intentionally LIGHT: it exposes only the CPU-pure
surface (config + event wire-shape + version) so that ``import gnosis_training``
succeeds on a CPU box without pulling torch / transformers / trl. The heavy
trainer modules (``gnosis_training.sft`` / ``.reward`` / ``.ppo``) are opt-in
and lazy-import their dependencies inside their builder functions.
"""
from __future__ import annotations

from .config import EvalConfig, PPOConfig, RewardConfig, SFTConfig, TrainingSeed
from .event import GnosisEvent

__version__ = "0.1.0"

__all__ = [
    "__version__",
    "GnosisEvent",
    "SFTConfig",
    "RewardConfig",
    "PPOConfig",
    "EvalConfig",
    "TrainingSeed",
]