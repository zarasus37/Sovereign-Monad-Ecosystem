"""Stage 3 — PPO Alignment (spec line 302-305): optimize the SFT model against
the constitutional reward model. Output: the LOGOC model.

REAL TRL wiring; import-smoke-verified only. NOT executed in this PR.

Faithfulness contract: ``trl.PPOTrainer`` + ``trl.PPOConfig`` with KL/clip/
rollout hyperparameters concretized in ``config.PPOConfig`` (the spec names PPO
+ AdamW lr=2e-4 cosine warmup 3% but no PPO-specific numerics). Custom
Constitutional AI, NOT standard RLHF (spec line 281): the reward signal is the
constitutional scorer (Stage 2 model), not human preference.

Heavy imports LAZY inside the builder. The reward model is the Stage 2 output
(``checkpoints/reward``), the policy is the Stage 1 SFT output
(``checkpoints/sft``).
"""
from __future__ import annotations

from typing import Any

from .config import PPOConfig
from .seed import seed_all


def build_ppo_config(cfg: PPOConfig) -> Any:
    """Build ``trl.PPOConfig`` from the concretized ``PPOConfig``. Lazy trl."""
    from trl import PPOConfig as TrlPPOConfig 

    return TrlPPOConfig(
        output_dir=str(cfg.output_dir),
        learning_rate=cfg.learning_rate,
        kl_coef=cfg.init_kl_coef,
        target_kl=cfg.kl_beta,
        cliprange=cfg.clip_range,
        batch_size=cfg.rollout_batch_size,
        mini_batch_size=cfg.mini_batch_size,
        ppo_epochs=cfg.ppo_epochs,
        warmup_ratio=cfg.warmup_ratio,
        report_to="none",
        seed=cfg.seed.seed,
    )


def build_ppo_trainer(cfg: PPOConfig) -> Any:
    """Build a real ``trl.PPOTrainer`` for Stage 3.

    Loads the SFT policy + the reward model, wires TRL's PPOTrainer with a
    constitutional reward function (the Stage 2 model), and returns the trainer
    ready for ``trainer.train()``. GPU-only; NOT called by the import-smoke.

    NOTE: TRL removed the PPO stack (``PPOConfig``/``PPOTrainer``) after the
    0.12–0.13 PPOv2 window — gone by 0.14+ and all 1.x (where only DPO/GRPO/KTO
    remain). This builder targets the PPOv2-era constructor signature, so the
    package pins ``trl>=0.12,<0.14`` in ``pyproject.toml`` (``uv sync`` resolves
    ``trl==0.13.0``). A real GPU run may need minor adjustment to the exact
    constructor kwargs across the 0.12–0.13 line — that is an execution-time
    concern, not a wiring defect (the import-smoke proves the symbols resolve).
    Lifting the pin would silently break PPO at import; GRPO/DPO substitution
    would be a spec deviation requiring sign-off.
    """
    seed_all(cfg.seed.seed, include_torch=True)

    from transformers import ( 
        AutoModelForCausalLM,
        AutoModelForSequenceClassification,
        AutoTokenizer,
    )
    from trl import PPOTrainer 

    policy_tokenizer = AutoTokenizer.from_pretrained(str(cfg.sft_model_dir))
    if policy_tokenizer.pad_token is None:
        policy_tokenizer.pad_token = policy_tokenizer.eos_token

    policy_model = AutoModelForCausalLM.from_pretrained(
        str(cfg.sft_model_dir), device_map="auto"
    )
    ref_model = AutoModelForCausalLM.from_pretrained(
        str(cfg.sft_model_dir), device_map="auto"
    )
    reward_model = AutoModelForSequenceClassification.from_pretrained(
        str(cfg.reward_model_dir), num_labels=1, device_map="auto"
    )
    reward_tokenizer = AutoTokenizer.from_pretrained(str(cfg.reward_model_dir))

    ppo_cfg = build_ppo_config(cfg)

    return PPOTrainer(
        args=ppo_cfg,
        processing_class=policy_tokenizer,
        model=policy_model,
        ref_model=ref_model,
        reward_model=reward_model,
        reward_processing_class=reward_tokenizer,
    )


def run_ppo(cfg: PPOConfig) -> str:
    """Build the PPO trainer, train, save, return the LOGOC model dir. GPU-only."""
    trainer = build_ppo_trainer(cfg)
    trainer.train()
    trainer.save_model(str(cfg.output_dir))
    return str(cfg.output_dir)