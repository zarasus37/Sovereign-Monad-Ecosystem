"""config.py — frozen config defaults match the spec + concretizations (CPU-pure)."""
from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from gnosis_training.config import (
    EvalConfig,
    GRPOConfig,
    RewardConfig,
    SFTConfig,
    TrainingSeed,
)
from gnosis_training.generated import hyperparams as H


def test_sft_config_carries_spec_mandated_values():
    """Spec line 279-283: LLaMA 3.1 8B, QLoRA 4-bit rank=64, lr=2e-4 cosine 3%."""
    cfg = SFTConfig()
    assert cfg.base_model_id == H.BASE_MODEL_ID
    assert cfg.lora_rank == 64
    assert cfg.learning_rate == 2e-4
    assert cfg.lr_schedule == "cosine"
    assert cfg.warmup_ratio == 0.03


def test_lora_alpha_is_twice_rank_qlora_heuristic():
    """Concretization: alpha = 2 * rank (the standard QLoRA heuristic)."""
    cfg = SFTConfig()
    assert cfg.lora_alpha == 2 * cfg.lora_rank == 128


def test_lora_target_modules_cover_all_linear_layers():
    """Concretization: full linear target set (TRL/peft QLoRA default)."""
    cfg = SFTConfig()
    assert "q_proj" in cfg.lora_target_modules
    assert "gate_proj" in cfg.lora_target_modules
    assert "down_proj" in cfg.lora_target_modules


def test_reward_config_scalar_head_by_default():
    """num_labels=1 → scalar regression head (MSE on 0-1 total). The
    per-criterion 5-head variant is a future refinement, off by default."""
    cfg = RewardConfig()
    assert cfg.num_labels == 1
    assert cfg.per_criterion_heads is False


def test_reward_base_same_as_sft_base_trained_separately():
    """Spec line 282: reward model trained separately (its own QLoRA of the
    same 8B base)."""
    assert RewardConfig().base_model_id == SFTConfig().base_model_id == H.BASE_MODEL_ID


def test_grpo_config_concretized_kl_clip_and_group_size():
    """Spec names the Stage-3 optimizer + AdamW lr but no GRPO numerics; these
    are concretizations (TRL GRPOConfig defaults + DeepSeek-R1 practice)."""
    cfg = GRPOConfig()
    assert cfg.kl_beta > 0
    assert 0 < cfg.clip_epsilon <= 0.3
    assert cfg.num_generations >= 1
    # GRPO constraint: per_device batch must be divisible by num_generations
    # (the group size) so each device step holds whole groups.
    assert cfg.per_device_train_batch_size % cfg.num_generations == 0


def test_grpo_output_dir_is_grpo_not_legacy_ppo():
    """The Stage-3 checkpoint dir follows the optimizer rename (checkpoints/grpo),
    not the superseded PPO name (compared as Path, not str, for cross-platform)."""
    from pathlib import Path

    assert GRPOConfig().output_dir == Path("checkpoints/grpo")
    assert EvalConfig().grpo_model_dir == Path("checkpoints/grpo")


def test_eval_thresholds_are_concretizations():
    """Spec lists the eval batteries but no numeric gates — these are
    concretized in hyperparams.py."""
    cfg = EvalConfig()
    assert cfg.total_mae_max == H.EVAL_TOTAL_MAE_MAX
    assert cfg.total_r2_min == H.EVAL_TOTAL_R2_MIN


def test_default_seed_is_42():
    """Concretization of the spec's silent training-seed (repo discipline =
    byte-reproducibility; default 42)."""
    assert TrainingSeed().seed == 42
    assert SFTConfig().seed.seed == 42
    assert RewardConfig().seed.seed == 42


def test_configs_are_frozen():
    """Domain types are frozen dataclasses (repo convention: not pydantic)."""
    cfg = SFTConfig()
    with pytest.raises(FrozenInstanceError):
        cfg.learning_rate = 1e-5  # type: ignore[misc]


def test_preference_category_counts_sum_to_250():
    """Reference: BUILD EXACTLY THIS DISTRIBUTION (250 pairs, 8 categories)."""
    assert H.PREFERENCE_TOTAL_TARGET == 250
    assert sum(H.PREFERENCE_CATEGORY_COUNTS.values()) == 250
    assert H.PREFERENCE_CATEGORY_COUNTS["CAT1"] == 50
    assert H.PREFERENCE_CATEGORY_COUNTS["CAT8"] == 10


def test_preference_gap_and_apeiron_constants_match_reference():
    """Reference RULE 1 (gap >= 0.15) and RULE 6 (apeiron 0.55-0.71)."""
    assert H.PREFERENCE_MIN_SCORE_GAP == 0.15
    assert H.APEIRON_SCORE_MIN == 0.55
    assert H.APEIRON_SCORE_MAX == 0.71