"""config.py dry-run factories — the tiny-model preset is a faithful
concretization of the frozen spec defaults via ``dataclasses.replace`` (CPU-pure).

The dry-run preset swaps the base model + sizes WITHOUT mutating the frozen
dataclass defaults (the real 8B contract stays intact). These tests pin the
dry-run shape so a future edit cannot silently regress it — or silently collapse
the dry run back into the 8B config.
"""
from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from gnosis_training.config import (
    SFTConfig,
    dry_run_eval,
    dry_run_grpo,
    dry_run_reward,
    dry_run_sft,
)
from gnosis_training.generated import hyperparams as H


def test_dry_run_sft_uses_tiny_model_and_dirs():
    cfg = dry_run_sft()
    assert cfg.base_model_id == H.DRY_RUN_BASE_MODEL_ID
    assert cfg.base_model_id != H.BASE_MODEL_ID  # never the 8B model
    assert cfg.output_dir.as_posix() == "dryrun/sft"   # never checkpoints/sft
    assert cfg.max_seq_length == H.DRY_RUN_SFT_MAX_SEQ_LENGTH
    assert cfg.num_epochs == 1
    assert cfg.per_device_train_batch_size == 1
    # The frozen real-run defaults are untouched.
    assert SFTConfig().base_model_id == H.BASE_MODEL_ID


def test_dry_run_reward_uses_tiny_model_and_dirs():
    cfg = dry_run_reward()
    assert cfg.base_model_id == H.DRY_RUN_BASE_MODEL_ID
    assert cfg.output_dir.as_posix() == "dryrun/reward"
    assert cfg.max_length == H.DRY_RUN_REWARD_MAX_LENGTH
    assert cfg.num_epochs == 1


def test_dry_run_grpo_uses_tiny_group_and_dryrun_model_dirs():
    cfg = dry_run_grpo()
    assert cfg.num_generations == H.DRY_RUN_GRPO_NUM_GENERATIONS == 2
    assert cfg.max_completion_length == H.DRY_RUN_GRPO_MAX_COMPLETION_LENGTH
    assert cfg.per_device_train_batch_size == H.DRY_RUN_GRPO_PER_DEVICE_BATCH
    # GRPO reads SFT + reward from the dryrun outputs, not checkpoints/.
    assert cfg.sft_model_dir.as_posix() == "dryrun/sft"
    assert cfg.reward_model_dir.as_posix() == "dryrun/reward"
    assert cfg.output_dir.as_posix() == "dryrun/grpo"
    assert cfg.num_train_epochs == 1
    # batch divisible by num_generations (TRL's hard requirement).
    assert cfg.per_device_train_batch_size % cfg.num_generations == 0


def test_dry_run_eval_reads_dryrun_model_dirs():
    cfg = dry_run_eval()
    assert cfg.sft_model_dir.as_posix() == "dryrun/sft"
    assert cfg.reward_model_dir.as_posix() == "dryrun/reward"
    assert cfg.grpo_model_dir.as_posix() == "dryrun/grpo"
    assert cfg.output_dir.as_posix() == "dryrun/eval"
    assert cfg.test_jsonl.as_posix() == "data/gnosis-events-test.jsonl"


def test_dry_run_factories_are_replace_based_not_new_defaults():
    """The frozen dataclasses carry NO dry-run defaults; the factories build off
    the real config via ``replace`` so the real contract never drifts."""
    # A dry-run field that is NOT explicitly replaced must equal the real default.
    sft_real = SFTConfig()
    sft_dry = dry_run_sft()
    assert sft_dry.lora_rank == sft_real.lora_rank == H.LORA_RANK
    assert sft_dry.bnb_4bit_quant_type == sft_real.bnb_4bit_quant_type
    # And the real config is still frozen (replace does not mutate it).
    with pytest.raises(FrozenInstanceError):
        sft_real.base_model_id = "mutated"  # type: ignore[misc]


def test_dry_run_dirs_never_collide_with_real_run():
    """Every dry-run output dir is under dryrun/; no real-run checkpoints/ path
    leaks into the dry-run preset (and vice versa)."""
    for cfg in (dry_run_sft(), dry_run_reward(), dry_run_grpo(), dry_run_eval()):
        d = cfg.output_dir.as_posix()
        assert "dryrun" in d
        assert "checkpoints" not in d
    assert "checkpoints" in SFTConfig().output_dir.as_posix()
    assert "dryrun" not in SFTConfig().output_dir.as_posix()