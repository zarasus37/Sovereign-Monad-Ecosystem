"""Generated constants concretizing the spec's silent hyperparameters.

The spec (`theo-techno-cosmo/plex/archive/TTCL_v1_0_BREAKDOWN.md:275-311`) fixes
only a handful of values: LLaMA 3.1 8B, QLoRA 4-bit rank=64, AdamW lr=2e-4 cosine
warmup 3%, TRL (SFT/Reward/GRPO trainers — GRPO is the doctrinal Stage-3
optimizer; see the NOTE at TTCL_v1_0_BREAKDOWN.md:302). Every other hyperparameter
named in the TRL configs (batch size, context length, epochs, grad accumulation,
LoRA alpha / dropout / target modules, all GRPO beta/epsilon/generation params,
eval thresholds, seed) is a CONCRETIZATION — grounded in the nearest written
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

# GRPO (concretization — TRL GRPOConfig defaults + DeepSeek-R1 practice). Group
# size (num_generations) 8 is the TRL default and a single-GPU 8B QLoRA footprint
# (DeepSeek-R1 uses 64 on a large cluster — too large for one consumer GPU); KL
# beta 0.04 keeps the policy near the SFT reference (DeepSeek-R1 GRPO beta); the
# importance-ratio clip epsilon 0.2 is the PPO-norm value (the clip_range analog);
# loss_type 'grpo' is the canonical GRPO objective (DAPO / 'dapo' is trl 1.8's
# default and a documented future refinement, not adopted here — one doctrinal
# change at a time); lr 1e-6 is the DeepSeek-R1 / DeepSeekMath GRPO learning rate
# (alignment moves less than SFT's 2e-4); max_completion_length 512 leaves room
# for LOGOC's logic-compression reasoning (the constitution values visible
# reasoning chains); temperature 1.0 is the GRPO exploration default; num_iterations
# 1 is the DeepSeek-R1 single-pass-per-generation default. per_device batch 8 must
# be divisible by num_generations (8 → 1 prompt/device/step); grad-accum 4 →
# effective 4 prompts × 8 generations = 32 completions/step on one GPU.
GRPO_NUM_GENERATIONS = 8
GRPO_BETA = 0.04
GRPO_EPSILON = 0.2
GRPO_LEARNING_RATE = 1e-6
GRPO_MAX_COMPLETION_LENGTH = 512
GRPO_TEMPERATURE = 1.0
GRPO_NUM_ITERATIONS = 1
GRPO_LOSS_TYPE = "grpo"
GRPO_SCALE_REWARDS = "group"
GRPO_PER_DEVICE_BATCH = 8
GRPO_GRAD_ACCUM_STEPS = 4
GRPO_NUM_EPOCHS = 1

# Eval thresholds (concretization — spec Part 4 lists the batteries, gives no
# numeric gates). total MAE <= 0.08 and R² >= 0.6 are "reward model tracks the
# constitution scorer closely enough to trust as a GRPO reward signal."
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

# Content-level templating guards (RULES 3/4/5) — the structural fix for the
# PR #56 overclaim: a 240-pair file of canned templates scored a constant 0.927
# passed ``validate_pair`` (RULES 1/2/6 only inspect SCORES) because the validator
# never read the response TEXT. The reward trainer consumes the verbatim text, so
# a templated file is garbage-in-garbage-out even when its scores are consistent.
#   RULE 3 (per-pair)    : a non-bootstrap response must be non-empty and must not
#                         echo the prompt back (the #56 CAT7 mode: prompt × 4).
#   RULE 4 (worksheet)   : across the authored set, response diversity must stay
#                         above ``PREFERENCE_MIN_UNIQUE_RESPONSE_RATIO`` — canned
#                         templates reused across many pairs fail this.
#   RULE 5 (worksheet)   : every chosen response scored to the SAME total is a
#                         generator fingerprint, not a human judgment.
# Worksheet-level checks skip pairs marked ``synthetic=True`` (the dry-run stand-
# ins in ``synth_pairs.py`` are INTENTIONALLY a single canned template, honestly
# labelled — they exercise the trainer, they do not claim to be human-judged) and
# skip pairs with fewer than ``PREFERENCE_CONTENT_MIN_PAIRS_FOR_DIVERSITY`` authored
# rows (too few to judge diversity).
PREFERENCE_CONTENT_MIN_PAIRS_FOR_DIVERSITY = 6
PREFERENCE_MIN_UNIQUE_RESPONSE_RATIO = 0.40

# Constitution threshold (spec line 148 / reference): gates DATA generation,
# NOT the GRPO loop and NOT the SFT inclusion (SFT uses ``passes``).
CONSTITUTION_PASS_TOTAL = 0.72

# Wire-format version tag the data-gen consumer emits (mirrors
# @sovereign/gnosis-training-data EVENT_FORMAT_VERSION).
GNOSIS_EVENT_FORMAT_VERSION = "gnosis-event-v1"

# ── Dry-run preset (NOT spec-mandated — a concretization of the spec's silent
# "verify the pipeline before the real GPU run" step; see
# docs/gnosis-training/DRY_RUN_RUNBOOK.md). The dry run exercises the REAL
# QLoRA + GRPO code path end-to-end on a cheap GPU for ~$0-2 to catch
# config/data/wiring bugs before the 8B run. It is NOT a claim that the model
# learns the constitution — the synth preference pairs (synth_pairs.py) are
# clearly-labelled synthetic labels, NOT human judgments (spec line 478 still
# governs the real reward-model training).
#
# Qwen2.5-0.5B-Instruct is a real model that supports 4-bit QLoRA + a chat
# template + AutoModelForSequenceClassification (~1 GB download; fast on a 24
# GB GPU). It is a SIZE concretization only — the dry run uses the same
# BitsAndBytesConfig(load_in_4bit=True) + LoraConfig + SFTTrainer/RewardTrainer/
# GRPOTrainer code the 8B run uses.
DRY_RUN_BASE_MODEL_ID = "Qwen/Qwen2.5-0.5B-Instruct"

# Tiny sequence/generation lengths keep the dry run in minutes, not hours.
DRY_RUN_SFT_MAX_SEQ_LENGTH = 512
DRY_RUN_REWARD_MAX_LENGTH = 512
DRY_RUN_GRPO_MAX_COMPLETION_LENGTH = 64

# GRPO group size 2 (not 8) — the heavy memory driver on the real run; 2 is
# the smallest legal GRPO group (TRL requires num_generations divides the
# per-device batch) and proves the generation+group-relative-advantage path.
DRY_RUN_GRPO_NUM_GENERATIONS = 2
DRY_RUN_GRPO_PER_DEVICE_BATCH = 2  # divisible by num_generations (2 → 1 prompt/step)

# Tiny feedstock slices (prepare-feedstock.mjs emits these) — enough to exercise
# every stage's data path with real gradients in a few steps.
DRY_RUN_TRAIN_EVENTS = 16
DRY_RUN_TEST_EVENTS = 8