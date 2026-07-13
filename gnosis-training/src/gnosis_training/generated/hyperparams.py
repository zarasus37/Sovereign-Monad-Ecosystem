"""Generated constants concretizing the spec's silent hyperparameters.

The spec (`theo-techno-cosmo/plex/archive/TTCL_v1_0_BREAKDOWN.md:275-311`) fixes
only a handful of values: LLaMA 3.1 8B, QLoRA 4-bit rank=64, AdamW lr=2e-4 cosine
warmup 3%, TRL (SFT/Reward/PPO trainers). Every other hyperparameter named in
the TRL configs (batch size, context length, epochs, grad accumulation, LoRA
alpha / dropout / target modules, all PPO KL/clip/rollout params, eval
thresholds, seed) is a CONCRETIZATION — grounded in the nearest written
evidence (the reference preference-pair guide, TRL defaults, the repo's
determinism discipline) and documented here, NOT presented as spec-mandated.

Mirror of the gnostic-engine ``generated/numerics.py`` pattern: a frozen,
pure, dependency-free module that is the single source of truth for the
concretized numerics. Tests pin these values; trainers read them.
"""
from __future__ import annotations

# ── Spec-mandated (TTCL_v1_0_BREAKDOWN.md:279-283) — do not change ────────────
BASE_MODEL_ID = "meta-llama/Llama-3.1-8B"
LORA_RANK = 64
QLORA_BITS = 4
OPTIMIZER_LR = 2e-4
LR_SCHEDULE = "cosine"
LR_WARMUP_RATIO = 0.03
REWARD_BASE_MODEL_ID = "meta-llama/Llama-3.1-8B"  # trained separately (spec line 282)

# ── Concretizations (NOT spec-mandated — grounded in TRL defaults + QLoRA practice) ─
# LoRA alpha = 2 * rank is the standard QLoRA heuristic (Hu et al. 2021); dropout
# 0.05 and the full linear-target set are the TRL/peft QLoRA defaults.
LORA_ALPHA = 128
LORA_DROPOUT = 0.05
LORA_TARGET_MODULES = (
    "q_proj",
    "k_proj",
    "v_proj",
    "o_proj",
    "gate_proj",
    "up_proj",
    "down_proj",
)
# 4-bit nf4 with double-quantization + bfloat16 compute dtype is the standard
# QLoRA quantization config (Dettmers et al. 2023).
BNB_4BIT_QUANT_TYPE = "nf4"
BNB_4BIT_USE_DOUBLE_QUANT = True
BNB_4BIT_COMPUTE_DTYPE = "bfloat16"

# SFT (concretization). max_seq_length 2048 fits a single 8B QLoRA step on one
# consumer GPU; 3 epochs is the SFT norm; batch 4 × grad-accum 4 = effective 16.
SFT_MAX_SEQ_LENGTH = 2048
SFT_NUM_EPOCHS = 3
SFT_PER_DEVICE_BATCH = 4
SFT_GRAD_ACCUM_STEPS = 4
SFT_WARMUP_RATIO = LR_WARMUP_RATIO

# Reward model (concretization). num_labels=1 → scalar regression head (MSE) on
# the continuous 0–1 total score from the reference guide; per-criterion heads
# are a documented future refinement behind ``RewardConfig.per_criterion_heads``.
REWARD_NUM_LABELS = 1
REWARD_MAX_LENGTH = 2048
REWARD_PER_DEVICE_BATCH = 8
REWARD_GRAD_ACCUM_STEPS = 2
REWARD_NUM_EPOCHS = 1

# PPO (concretization — TRL PPOConfig defaults, lightly tightened). KL beta 0.05
# keeps the policy near the SFT ref; clip 0.2 is the PPO norm; rollout batch 128
# × mini-batch 32 is a single-GPU PPO footprint.
PPO_KL_BETA = 0.05
PPO_CLIP_RANGE = 0.2
PPO_ROLLOUT_BATCH = 128
PPO_MINI_BATCH = 32
PPO_PPO_EPOCHS = 4
PPO_LEARNING_RATE = 1.5e-5
PPO_INIT_KL_COEF = 0.2

# Eval thresholds (concretization — spec Part 4 lists the batteries, gives no
# numeric gates). total MAE <= 0.08 and R² >= 0.6 are "reward model tracks the
# constitution scorer closely enough to trust as a PPO signal."
EVAL_TOTAL_MAE_MAX = 0.08
EVAL_TOTAL_R2_MIN = 0.60
EVAL_PER_CRITERION_AGREEMENT_MIN = 0.70

# Reproducibility (concretization — spec is silent on training seed; mirrors
# the repo's byte-reproducibility discipline, the TS consumer/scheduler being
# deterministic). Default seed 42.
DEFAULT_SEED = 42

# Dataset-size targets (commentary, TTCL_v1_0_BREAKDOWN.md:591-615 — NOT
# spec-mandated). 5k events SFT; 500 pairs minimal RM; 10k full; 50k+ production.
SFT_TARGET_EVENTS = 5_000
REWARD_MIN_PAIRS = 500
REWARD_FULL_PAIRS = 10_000
REWARD_PRODUCTION_PAIRS = 50_000

# Preference-pair category distribution (reference:
# plex/CODE/preference_pair_generator_reference.py, "BUILD EXACTLY THIS
# DISTRIBUTION" — 250 pairs across 8 categories). Bootstrap sampler mirrors it.
PREFERENCE_CATEGORY_COUNTS: dict[str, int] = {
    "CAT1": 50,  # tripartite complete vs single-domain
    "CAT2": 40,  # logic compression visible vs conclusion only
    "CAT3": 35,  # source aligned vs moralizing
    "CAT4": 30,  # epistemic humility vs false certainty
    "CAT5": 30,  # no-RLHF vs RLHF-contaminated
    "CAT6": 30,  # near-miss (fails exactly one criterion)
    "CAT7": 25,  # domain-specific prompts
    "CAT8": 10,  # apeiron / contrariety (both below pass)
}
PREFERENCE_TOTAL_TARGET = sum(PREFERENCE_CATEGORY_COUNTS.values())  # 250

# Reference's quality-control rules (preference_pair_generator_reference.py).
PREFERENCE_MIN_SCORE_GAP = 0.15
PREFERENCE_CHOSEN_MIN_CRITERIA_PASSING = 4
PREFERENCE_CRITERION_PASS_THRESHOLD = 0.70
APEIRON_SCORE_MIN = 0.55
APEIRON_SCORE_MAX = 0.71

# Constitution threshold (spec line 148 / reference): gates DATA generation,
# NOT the PPO loop and NOT the SFT inclusion (SFT uses ``passes``).
CONSTITUTION_PASS_TOTAL = 0.72

# Wire-format version tag the data-gen consumer emits (mirrors
# @sovereign/gnosis-training-data EVENT_FORMAT_VERSION).
GNOSIS_EVENT_FORMAT_VERSION = "gnosis-event-v1"