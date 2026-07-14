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
    GRPO_BETA,
    GRPO_EPSILON,
    GRPO_GRAD_ACCUM_STEPS,
    GRPO_LEARNING_RATE,
    GRPO_LOSS_TYPE,
    GRPO_MAX_COMPLETION_LENGTH,
    GRPO_NUM_GENERATIONS,
    GRPO_NUM_ITERATIONS,
    GRPO_NUM_EPOCHS,
    GRPO_PER_DEVICE_BATCH,
    GRPO_SCALE_REWARDS,
    GRPO_TEMPERATURE,
    LORA_ALPHA,
    LORA_DROPOUT,
    LORA_RANK,
    LORA_TARGET_MODULES,
    LR_SCHEDULE,
    OPTIMIZER_LR,
    LR_WARMUP_RATIO,
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
class GRPOConfig:
    """Stage 3 — GRPO Alignment of the SFT model against the reward model (spec
    line 302-305; doctrinal upgrade from PPO — see the NOTE at
    ``TTCL_v1_0_BREAKDOWN.md:302``). Output: the LOGOC model.

    GRPO (Group Relative Policy Optimization) is the PPO-family optimizer that
    drops the learned value model in favor of a group-relative baseline from N
    completions per prompt. The reward signal is still the Stage-2 constitutional
    scorer (slotted in as ``reward_funcs``) — Custom Constitutional AI, NOT
    standard RLHF (spec line 281). All GRPO hyperparameters are concretizations
    (TRL ``GRPOConfig`` defaults + DeepSeek-R1 practice); the spec names the
    optimizer + AdamW lr but no GRPO-specific numerics.
    """

    sft_model_dir: Path = Path("checkpoints/sft")
    reward_model_dir: Path = Path("checkpoints/reward")
    output_dir: Path = Path("checkpoints/grpo")
    learning_rate: float = GRPO_LEARNING_RATE
    kl_beta: float = GRPO_BETA  # KL-to-reference coef (the PPO kl_coef analog)
    clip_epsilon: float = GRPO_EPSILON  # importance-ratio clip (the PPO clip_range analog)
    num_generations: int = GRPO_NUM_GENERATIONS  # group size G (N completions/prompt)
    num_iterations: int = GRPO_NUM_ITERATIONS  # optimization passes per generation batch
    max_completion_length: int = GRPO_MAX_COMPLETION_LENGTH
    temperature: float = GRPO_TEMPERATURE
    loss_type: str = GRPO_LOSS_TYPE
    scale_rewards: str = GRPO_SCALE_REWARDS
    per_device_train_batch_size: int = GRPO_PER_DEVICE_BATCH
    gradient_accumulation_steps: int = GRPO_GRAD_ACCUM_STEPS
    num_train_epochs: int = GRPO_NUM_EPOCHS
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
class EvalConfig:
    """Stage 4 — Evaluation Battery (spec line 307-310): constitution score
    regression, consistency checks, theo/techno/cosmo coherence.

    The spec lists the batteries but gives NO numeric pass/fail thresholds;
    these are concretizations (``generated/hyperparams.py``).
    """

    sft_model_dir: Path = Path("checkpoints/sft")
    reward_model_dir: Path = Path("checkpoints/reward")
    grpo_model_dir: Path = Path("checkpoints/grpo")
    test_jsonl: Path = Path("data/gnosis-events-test.jsonl")
    output_dir: Path = Path("eval/results")
    total_mae_max: float = EVAL_TOTAL_MAE_MAX
    total_r2_min: float = EVAL_TOTAL_R2_MIN
    per_criterion_agreement_min: float = EVAL_PER_CRITERION_AGREEMENT_MIN
    apeiron_score_min: float = APEIRON_SCORE_MIN
    apeiron_score_max: float = APEIRON_SCORE_MAX
    seed: TrainingSeed = TrainingSeed()