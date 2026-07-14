"""Stage 2 — Reward Model training on HUMAN-judged preference pairs (spec line
297-300, 478).

REAL TRL wiring; import-smoke-verified only. NOT executed in this PR.

Faithfulness contract: the reward model is a SEPARATE 4-bit QLoRA fine-tune of
the same LLaMA 3.1 8B base (spec line 282: "trained separately"), with a scalar
regression head (``num_labels=1``, MSE on the continuous 0-1 ``total`` score
from the reference preference-pair guide). A 5-way per-criterion head is a
documented FUTURE refinement behind ``RewardConfig.per_criterion_heads``
(False now). The reward model trains on **human-judged** pairs (spec line 478),
NOT the auto-generated bootstrap worksheet (``preference.py``).

Heavy imports are LAZY inside the builders. The 4-bit kernel (bitsandbytes) is
the opt-in ``qlora`` extra.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .config import RewardConfig
from .preference import (
    PreferencePair,
    validate_pair,
)
from .seed import seed_all


def build_reward_model(cfg: RewardConfig) -> Any:
    """Build ``AutoModelForSequenceClassification`` (num_labels=1 → scalar
    regression head, MSE) under 4-bit QLoRA. Lazy transformers + peft +
    bitsandbytes. GPU-only; not called by the import-smoke."""
    try:
        import bitsandbytes   # noqa: F401
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "4-bit QLoRA reward model needs bitsandbytes; run `uv sync --extra qlora`."
        ) from exc

    from transformers import ( 
        AutoModelForSequenceClassification,
        BitsAndBytesConfig,
    )
    import torch 

    bnb = BitsAndBytesConfig(  # type: ignore[no-untyped-call]
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
    )
    num_labels = 5 if cfg.per_criterion_heads else cfg.num_labels
    model = AutoModelForSequenceClassification.from_pretrained(
        cfg.base_model_id,
        num_labels=num_labels,
        quantization_config=bnb,
        device_map="auto",
    )
    return model


def _pairs_to_dataset(pairs: list[PreferencePair]) -> Any:
    """Project validated human-judged pairs into TRL ``RewardTrainer`` row
    shape: ``{prompt, chosen, rejected}`` (TRL's expected preference dataset
    columns). Lazy ``datasets`` import."""
    from datasets import Dataset 

    rows = []
    for p in pairs:
        # validate_pair returns [] for a valid pair; raise on any invalid.
        problems = validate_pair(p)
        if problems:
            raise ValueError(f"pair {p.pair_id}: {problems}")
        rows.append(
            {
                "prompt": p.prompt,
                "chosen": p.chosen.response,
                "rejected": p.rejected.response,
            }
        )
    return Dataset.from_list(rows)


def build_reward_trainer(cfg: RewardConfig, preference_pairs_jsonl: str | Path) -> Any:
    """Build a real ``trl.RewardTrainer`` for Stage 2. Loads HUMAN-judged
    preference pairs (spec line 478) from ``preference_pairs_ALL.jsonl``
    (reference schema — ``preference.load_human_pairs`` validates them).

    GPU-only; not called by the import-smoke. The 4-bit kernel is the ``qlora``
    extra."""
    seed_all(cfg.seed.seed, include_torch=True)

    from .preference import load_human_pairs
    from peft import LoraConfig 
    from transformers import AutoTokenizer
    from trl import RewardConfig, RewardTrainer  # type: ignore[attr-defined]

    pairs = load_human_pairs(preference_pairs_jsonl)
    if not pairs:
        raise ValueError(
            "no trainable preference pairs — reward model needs human-judged "
            "pairs (spec line 478), not the bootstrap worksheet"
        )
    dataset = _pairs_to_dataset(pairs)

    tokenizer = AutoTokenizer.from_pretrained(cfg.base_model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = build_reward_model(cfg)
    lora = LoraConfig(
        r=cfg.lora_rank,
        lora_alpha=cfg.lora_alpha,
        lora_dropout=cfg.lora_dropout,
        target_modules=list(cfg.lora_target_modules),
        bias="none",
        task_type="SEQ_CLS",
    )

    reward_cfg = RewardConfig(
        output_dir=str(cfg.output_dir),
        max_length=cfg.max_length,
        num_train_epochs=cfg.num_epochs,
        per_device_train_batch_size=cfg.per_device_train_batch_size,
        gradient_accumulation_steps=cfg.gradient_accumulation_steps,
        learning_rate=cfg.learning_rate,
        lr_scheduler_type=cfg.lr_schedule,
        warmup_ratio=cfg.warmup_ratio,
        report_to="none",
        seed=cfg.seed.seed,
        bf16=True,
    )

    return RewardTrainer(
        model=model,
        args=reward_cfg,
        train_dataset=dataset,
        processing_class=tokenizer,
        peft_config=lora,
    )


def run_reward(cfg: RewardConfig, preference_pairs_jsonl: str | Path) -> str:
    """Build the reward trainer, train, save the adapter, return its dir. GPU-only.

    The reward model is saved as a LoRA adapter + the trained ``score`` head
    under PEFT's ``modules_to_save`` naming (``RewardTrainer.save_model``). Stage
    3 GRPO loads it via ``PeftModel.from_pretrained`` (the native PEFT load
    restores the ``modules_to_save`` head correctly); it does NOT merge to a
    full model. A plain ``AutoModelForSequenceClassification.from_pretrained``
    load would drop the trained head (``MISSING`` → random) — surfaced by the
    dry run (PR #50 first GPU execution). The merge-and-export approach was
    tried in PR #50 but ``merge_and_unload`` does not relocate the
    ``modules_to_save`` head to the canonical ``score.weight`` key, so the saved
    full model still had a mangled head; loading via PeftModel is the correct
    fix and the merge was reverted.
    """
    trainer = build_reward_trainer(cfg, preference_pairs_jsonl)
    trainer.train()
    trainer.save_model(str(cfg.output_dir))  # adapter + tokenizer + modules_to_save head
    return str(cfg.output_dir)