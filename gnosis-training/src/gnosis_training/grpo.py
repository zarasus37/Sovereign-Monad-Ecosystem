"""Stage 3 — GRPO Alignment (spec line 302-305; doctrinal upgrade from PPO —
see the NOTE at ``TTCL_v1_0_BREAKDOWN.md:302``): optimize the SFT model against
the constitutional reward model. Output: the LOGOC model.

REAL TRL wiring; import-smoke-verified only. NOT executed in this PR.

Faithfulness contract: ``trl.GRPOTrainer`` + ``trl.GRPOConfig`` on modern TRL
(``trl>=0.15`` — GRPO is the maintained PPO-family path; ``PPOTrainer``/
``PPOConfig`` were removed upstream after the 0.12-0.13 PPOv2 window, gone by
0.14+ and all 1.x where SFT/Reward/GRPO/DPO/KTO remain). GRPO = Group Relative
Policy Optimization: a PPO-family optimizer with the same importance-ratio +
KL-to-reference discipline, but NO learned value model — the advantage baseline
is computed from N completions per prompt (group-relative). The reward signal is
the Stage-2 constitutional scorer, slotted in as ``reward_funcs`` (the reward
model) — Custom Constitutional AI, NOT standard RLHF (spec line 281). GRPO is
the optimizer DeepSeek-R1 / Qwen use; it is the higher-standard PPO-family
choice for a reward-model-driven constitutional architecture on an 8B QLoRA
footprint (no value model = less memory + no value-function reward hacking).

Heavy imports LAZY inside the builder. The reward model is the Stage 2 output
(``checkpoints/reward``); the policy is the Stage 1 SFT output
(``checkpoints/sft``), loaded 4-bit + a fresh GRPO-stage LoRA (QLoRA continue).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import GRPOConfig
from .generated.hyperparams import LR_SCHEDULE
from .seed import seed_all


def _read_peft_base_model_id(adapter_dir: str | Path) -> str:
    """Read ``base_model_name_or_path`` from a PEFT adapter dir's
    ``adapter_config.json``. The reward model is saved as a LoRA adapter
    (``RewardTrainer.save_model``); GRPO loads it via ``PeftModel.from_pretrained``,
    which needs the base model id to instantiate the base before applying the
    adapter. Reading it from the adapter config (rather than threading a
    ``reward_base_model_id`` through ``GRPOConfig``) keeps the config frozen and
    works for both the dry-run + real-run bases."""
    p = Path(adapter_dir) / "adapter_config.json"
    with p.open("r", encoding="utf-8") as fh:
        adapter_cfg = json.load(fh)
    return str(adapter_cfg["base_model_name_or_path"])


def build_grpo_config(cfg: GRPOConfig) -> Any:
    """Build ``trl.GRPOConfig`` from the concretized ``GRPOConfig``. Lazy trl.

    Only fields that exist on the modern ``GRPOConfig`` are set (``max_prompt_``
    length is NOT a field in trl 1.8 — GRPO infers prompt length from the
    dataset). GPU-only path; not called by the import-smoke.
    """
    from trl import GRPOConfig as TrlGRPOConfig  # type: ignore[attr-defined]

    return TrlGRPOConfig(
        output_dir=str(cfg.output_dir),
        learning_rate=cfg.learning_rate,
        beta=cfg.kl_beta,
        epsilon=cfg.clip_epsilon,
        num_generations=cfg.num_generations,
        num_iterations=cfg.num_iterations,
        max_completion_length=cfg.max_completion_length,
        temperature=cfg.temperature,
        loss_type=cfg.loss_type,
        scale_rewards=cfg.scale_rewards,
        per_device_train_batch_size=cfg.per_device_train_batch_size,
        gradient_accumulation_steps=cfg.gradient_accumulation_steps,
        num_train_epochs=cfg.num_train_epochs,
        warmup_ratio=cfg.warmup_ratio,
        lr_scheduler_type=LR_SCHEDULE,
        report_to="none",
        seed=cfg.seed.seed,
        data_seed=cfg.seed.seed,
    )


def build_grpo_trainer(cfg: GRPOConfig, train_jsonl: str | Path) -> Any:
    """Build a real ``trl.GRPOTrainer`` for Stage 3.

    Loads the SFT policy (4-bit QLoRA continue + a fresh GRPO-stage LoRA) and the
    Stage-2 reward model, wires TRL's GRPOTrainer with the reward model as the
    reward function (``reward_funcs``) and the Gnosis-event prompts as the
    ``train_dataset`` (system+user messages; GRPO generates + scores the
    assistant), and returns the trainer ready for ``trainer.train()``. GPU-only;
    NOT called by the import-smoke.

    The reward model is loaded via ``PeftModel.from_pretrained`` (the adapter on
    its base), NOT plain ``AutoModelForSequenceClassification.from_pretrained``.
    The reward trainer saves a LoRA adapter whose trained ``score`` head lives
    under PEFT's ``modules_to_save`` naming; the native PEFT load restores that
    head correctly, whereas a plain load drops it (loads as ``MISSING`` → random
    head → garbage reward signal). Surfaced by the dry run (PR #50 first GPU
    execution). The base id is read from the adapter's ``adapter_config.json``.

    GRPO has no learned value model — the advantage baseline is group-relative
    (N completions per prompt, ``cfg.num_generations``). When ``beta > 0``
    (``cfg.kl_beta``), the trainer regularizes against its internal frozen
    reference policy; no explicit ``ref_model`` is passed (unlike the PPOv2
    signature).
    """
    seed_all(cfg.seed.seed, include_torch=True)

    from .dataset import load_grpo_prompt_dataset
    from peft import LoraConfig, PeftModel
    from transformers import (
        AutoModelForSequenceClassification,
        AutoTokenizer,
        BitsAndBytesConfig,
    )
    from trl import GRPOTrainer  # type: ignore[attr-defined]

    bnb = BitsAndBytesConfig(  # type: ignore[no-untyped-call]
        load_in_4bit=True,
        bnb_4bit_quant_type=cfg.bnb_4bit_quant_type,
        bnb_4bit_use_double_quant=cfg.bnb_4bit_use_double_quant,
        bnb_4bit_compute_dtype=cfg.bnb_4bit_compute_dtype,
    )

    policy_tokenizer = AutoTokenizer.from_pretrained(str(cfg.sft_model_dir))
    if policy_tokenizer.pad_token is None:
        policy_tokenizer.pad_token = policy_tokenizer.eos_token

    # Reward model: native PEFT load (restores the trained modules_to_save head).
    reward_base_id = _read_peft_base_model_id(cfg.reward_model_dir)
    reward_base = AutoModelForSequenceClassification.from_pretrained(
        reward_base_id, num_labels=1, device_map="auto"
    )
    reward_model = PeftModel.from_pretrained(reward_base, str(cfg.reward_model_dir))
    reward_model.eval()
    reward_tokenizer = AutoTokenizer.from_pretrained(str(cfg.reward_model_dir))

    lora_config = LoraConfig(
        r=cfg.lora_rank,
        lora_alpha=cfg.lora_alpha,
        lora_dropout=cfg.lora_dropout,
        target_modules=list(cfg.lora_target_modules),
        task_type="CAUSAL_LM",
    )

    grpo_cfg = build_grpo_config(cfg)
    train_dataset = load_grpo_prompt_dataset(train_jsonl, apply_passes_gate=True)

    return GRPOTrainer(
        model=str(cfg.sft_model_dir),
        reward_funcs=reward_model,
        args=grpo_cfg,
        train_dataset=train_dataset,
        processing_class=policy_tokenizer,
        reward_processing_classes=reward_tokenizer,
        quantization_config=bnb,
        peft_config=lora_config,
    )


def run_grpo(cfg: GRPOConfig, train_jsonl: str | Path) -> str:
    """Build the GRPO trainer, train, save, return the LOGOC model dir. GPU-only."""
    trainer = build_grpo_trainer(cfg, train_jsonl)
    trainer.train()
    trainer.save_model(str(cfg.output_dir))
    return str(cfg.output_dir)