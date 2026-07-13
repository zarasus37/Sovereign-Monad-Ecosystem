"""Frozen training configs — the single source of truth for every hyperparameter.

The spec (``TTCL_v1_0_BREAKDOWN.md:275-311``) fixes only a few values (LLaMA
3.1 8B, QLoRA 4-bit rank=64, AdamW lr=2e-4 cosine warmup 3%, TRL). Every other
hyperparameter is a CONCRETIZATION — see ``generated/hyperparams.py`` for the
grounding (TRL defaults, QLoRA practice, the repo's determinism discipline).
These frozen dataclasses read those constants and expose them to the trainers
and the CLI; they carry no defaults of their own beyond what hyperparams pins.

Mirrors the repo's Python domain-type convention: FROZEN dataclasses, not
pydantic (no HTTP boundary here). CPU-pure — no heavy imports.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .generated.hyperparams import (
    APEIRON_SCORE_MAX,
    APEIRON_SCORE_MIN,
    BASE_MODEL_ID,
    BNB_4BIT_COMPUTE_DTYPE,
    BNB_4BIT_QUANT_TYPE,
    BNB_4BIT_USE_DOUBLE_QUANT,
    DEFAULT_SEED,
    EVAL_PER_CRITERION_AGREEMENT_MIN,
    EVAL_TOTAL_MAE_MAX,
    EVAL_TOTAL_R2_MIN,
    LORA_ALPHA,
    LORA_DROPOUT,
    LORA_RANK,
    LORA_TARGET_MODULES,
    LR_SCHEDULE,
    OPTIMIZER_LR,
    LR_WARMUP_RATIO,
    PPO_CLIP_RANGE,
    PPO_INIT_KL_COEF,
    PPO_KL_BETA,
    PPO_LEARNING_RATE,
    PPO_MINI_BATCH,
    PPO_PPO_EPOCHS,
    PPO_ROLLOUT_BATCH,
    REWARD_BASE_MODEL_ID,
    REWARD_GRAD_ACCUM_STEPS,
    REWARD_MAX_LENGTH,
    REWARD_NUM_EPOCHS,
    REWARD_NUM_LABELS,
    REWARD_PER_DEVICE_BATCH,
    SFT_GRAD_ACCUM_STEPS,
    SFT_MAX_SEQ_LENGTH,
    SFT_NUM_EPOCHS,
    SFT_PER_DEVICE_BATCH,
)


@dataclass(frozen=True)
class TrainingSeed:
    """Reproducibility seed + deterministic-mode flag.

    Concretization of the spec's silent training-seed (the spec never names a
    seed; the repo's discipline is byte-reproducibility — the TS consumer /
    scheduler are deterministic). Default 42. ``deterministic`` toggles
    ``torch.use_deterministic_algorithms`` (warn-only on CPU where some kernels
    lack deterministic implementations).
    """

    seed: int = DEFAULT_SEED
    deterministic: bool = True


@dataclass(frozen=True)
class SFTConfig:
    """Stage 1 — Supervised Fine-Tuning on gnosis events (spec line 293-295).

    Reads the constitution-verified JSONL (``passes``-gated by the dataset
    adapter) and learns to follow the LOGOC system prompt.
    """

    base_model_id: str = BASE_MODEL_ID
    output_dir: Path = Path("checkpoints/sft")
    max_seq_length: int = SFT_MAX_SEQ_LENGTH
    num_epochs: int = SFT_NUM_EPOCHS
    per_device_train_batch_size: int = SFT_PER_DEVICE_BATCH
    gradient_accumulation_steps: int = SFT_GRAD_ACCUM_STEPS
    learning_rate: float = OPTIMIZER_LR
    lr_schedule: str = LR_SCHEDULE
    warmup_ratio: float = LR_WARMUP_RATIO
    lora_rank: int = LORA_RANK
    lora_alpha: int = LORA_ALPHA
    lora_dropout: float = LORA_DROPOUT
    lora_target_modules: tuple[str, ...] = LORA_TARGET_MODULES
    bnb_4bit_quant_type: str = BNB_4BIT_QUANT_TYPE
    bnb_4bit_use_double_quant: bool = BNB_4BIT_USE_DOUBLE_QUANT
    bnb_4bit_compute_dtype: str = BNB_4BIT_COMPUTE_DTYPE
    seed: TrainingSeed = TrainingSeed()


@dataclass(frozen=True)
class RewardConfig:
    """Stage 2 — Reward Model training on HUMAN-judged preference pairs (spec
    line 478). Trained separately (its own QLoRA fine-tune of the same 8B base).

    ``num_labels=1`` → a scalar regression head (MSE on the continuous 0-1 total
    score from the reference guide). ``per_criterion_heads`` is a documented
    FUTURE refinement (5 heads, one per criterion); it is False now and the
    builder ignores it until implemented.
    """

    base_model_id: str = REWARD_BASE_MODEL_ID
    output_dir: Path = Path("checkpoints/reward")
    max_length: int = REWARD_MAX_LENGTH
    num_labels: int = REWARD_NUM_LABELS
    num_epochs: int = REWARD_NUM_EPOCHS
    per_device_train_batch_size: int = REWARD_PER_DEVICE_BATCH
    gradient_accumulation_steps: int = REWARD_GRAD_ACCUM_STEPS
    learning_rate: float = OPTIMIZER_LR
    lr_schedule: str = LR_SCHEDULE
    warmup_ratio: float = LR_WARMUP_RATIO
    lora_rank: int = LORA_RANK
    lora_alpha: int = LORA_ALPHA
    lora_dropout: float = LORA_DROPOUT
    lora_target_modules: tuple[str, ...] = LORA_TARGET_MODULES
    per_criterion_heads: bool = False  # future refinement, not spec-mandated
    seed: TrainingSeed = TrainingSeed()


@dataclass(frozen=True)
class PPOConfig:
    """Stage 3 — PPO alignment of the SFT model against the reward model (spec
    line 302-305). Output: the LOGOC model.

    All PPO hyperparameters are concretizations (TRL PPOConfig defaults, lightly
    tightened). The spec names PPO + the optimizer (AdamW lr=2e-4 cosine warmup
    3%) but no PPO-specific numerics.
    """

    sft_model_dir: Path = Path("checkpoints/sft")
    reward_model_dir: Path = Path("checkpoints/reward")
    output_dir: Path = Path("checkpoints/ppo")
    learning_rate: float = PPO_LEARNING_RATE
    kl_beta: float = PPO_KL_BETA
    init_kl_coef: float = PPO_INIT_KL_COEF
    clip_range: float = PPO_CLIP_RANGE
    rollout_batch_size: int = PPO_ROLLOUT_BATCH
    mini_batch_size: int = PPO_MINI_BATCH
    ppo_epochs: int = PPO_PPO_EPOCHS
    warmup_ratio: float = LR_WARMUP_RATIO
    seed: TrainingSeed = TrainingSeed()


@dataclass(frozen=True)
class EvalConfig:
    """Stage 4 — Evaluation Battery (spec line 307-310): constitution score
    regression, consistency checks, theo/techno/cosmo coherence.

    The spec lists the batteries but gives NO numeric pass/fail thresholds;
    these are concretizations (``generated/hyperparams.py``).
    """

    sft_model_dir: Path = Path("checkpoints/sft")
    reward_model_dir: Path = Path("checkpoints/reward")
    ppo_model_dir: Path = Path("checkpoints/ppo")
    test_jsonl: Path = Path("data/gnosis-events-test.jsonl")
    output_dir: Path = Path("eval/results")
    total_mae_max: float = EVAL_TOTAL_MAE_MAX
    total_r2_min: float = EVAL_TOTAL_R2_MIN
    per_criterion_agreement_min: float = EVAL_PER_CRITERION_AGREEMENT_MIN
    apeiron_score_min: float = APEIRON_SCORE_MIN
    apeiron_score_max: float = APEIRON_SCORE_MAX
    seed: TrainingSeed = TrainingSeed()