"""Stage 1 — SFT (Supervised Fine-Tuning) on gnosis events (spec line 293-295).

REAL TRL wiring; import-smoke-verified only. NOT executed in this PR (no GPU,
no model load, no weight download). The LLaMA 3.1 8B + 4-bit QLoRA run is a
future GPU job — deliberately not stubbed.

Faithfulness contract: this module builds a real ``trl.SFTTrainer`` with a real
``peft.LoraConfig`` + ``transformers.BitsAndBytesConfig`` (4-bit nf4). ALL heavy
imports are LAZY (inside ``build_sft_trainer``) so ``import gnosis_training.sft``
resolves on a CPU box without CUDA and without bitsandbytes installed. The
``--smoke-imports`` CLI mode proves the module + torch/transformers/trl/peft
resolve; it does NOT call this builder.

TS mirror: ``@sovereign/gnosis-training-data`` (feedstock producer). Python
trainer: this module.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .config import SFTConfig
from .dataset import load_gnosis_dataset
from .seed import seed_all


def build_quantization_config(cfg: SFTConfig) -> Any:
    """Build the ``transformers.BitsAndBytesConfig`` for 4-bit nf4 QLoRA (spec
    line 280: 4-bit quantization). Lazy-imports transformers + bitsandbytes.

    Raises a documented error if ``bitsandbytes`` is absent (it is an opt-in
    ``qlora`` extra — the 4-bit kernel is hard to build on native Windows)."""
    try:
        import torch 
        from transformers import BitsAndBytesConfig 
    except ImportError as exc:  # pragma: no cover — exercised on a GPU box
        raise RuntimeError(
            "SFT quantization needs transformers + torch; run `uv sync` (core deps)."
        ) from exc

    try:
        import bitsandbytes   # noqa: F401
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "4-bit QLoRA needs bitsandbytes; run `uv sync --extra qlora`."
        ) from exc

    compute_dtype = getattr(torch, cfg.bnb_4bit_compute_dtype, torch.bfloat16)
    return BitsAndBytesConfig(  # type: ignore[no-untyped-call]
        load_in_4bit=True,
        bnb_4bit_quant_type=cfg.bnb_4bit_quant_type,
        bnb_4bit_use_double_quant=cfg.bnb_4bit_use_double_quant,
        bnb_4bit_compute_dtype=compute_dtype,
    )


def build_lora_config(cfg: SFTConfig) -> Any:
    """Build the ``peft.LoraConfig`` (spec line 280: LoRA rank=64). Lazy peft."""
    from peft import LoraConfig 

    return LoraConfig(
        r=cfg.lora_rank,
        lora_alpha=cfg.lora_alpha,
        lora_dropout=cfg.lora_dropout,
        target_modules=list(cfg.lora_target_modules),
        bias="none",
        task_type="CAUSAL_LM",
    )


def build_sft_trainer(
    cfg: SFTConfig,
    train_jsonl: str | Path,
    eval_jsonl: str | Path | None = None,
) -> Any:
    """Build a real ``trl.SFTTrainer`` for Stage 1 SFT.

    Loads the passes-gated Gnosis-event JSONL (``dataset.load_gnosis_dataset``),
    the LLaMA 3.1 8B base under 4-bit QLoRA, and wires TRL's ``SFTTrainer`` with
    chat-format data. Seeds every RNG before touching the model.

    This function is NOT called by the import-smoke. It runs on a GPU box with
    `uv sync --extra qlora`. No part of it executes in this PR.
    """
    seed_all(cfg.seed.seed, include_torch=True)

    from transformers import AutoModelForCausalLM, AutoTokenizer
    from trl import SFTConfig as TrlSFTConfig  # type: ignore[attr-defined]
    from trl import SFTTrainer  # type: ignore[attr-defined]

    tokenizer = AutoTokenizer.from_pretrained(cfg.base_model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        cfg.base_model_id,
        quantization_config=build_quantization_config(cfg),
        device_map="auto",
    )
    model.config.use_cache = False

    train_dataset = load_gnosis_dataset(train_jsonl, apply_passes_gate=True)
    eval_dataset = (
        load_gnosis_dataset(eval_jsonl, apply_passes_gate=True)
        if eval_jsonl is not None
        else None
    )

    trainer_cfg = TrlSFTConfig(
        output_dir=str(cfg.output_dir),
        max_length=cfg.max_seq_length,
        num_train_epochs=cfg.num_epochs,
        per_device_train_batch_size=cfg.per_device_train_batch_size,
        gradient_accumulation_steps=cfg.gradient_accumulation_steps,
        learning_rate=cfg.learning_rate,
        lr_scheduler_type=cfg.lr_schedule,
        warmup_ratio=cfg.warmup_ratio,
        logging_steps=10,
        save_strategy="epoch",
        report_to="none",  # W&B/MLflow wired-but-deferred (tracking.py)
        seed=cfg.seed.seed,
        bf16=True,
    )

    return SFTTrainer(
        model=model,
        args=trainer_cfg,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        processing_class=tokenizer,
        peft_config=build_lora_config(cfg),
    )


def run_sft(cfg: SFTConfig, train_jsonl: str | Path, eval_jsonl: str | Path | None = None) -> str:
    """Build the trainer, train, save, return the checkpoint dir. GPU-only."""
    trainer = build_sft_trainer(cfg, train_jsonl, eval_jsonl)
    trainer.train()
    trainer.save_model(str(cfg.output_dir))
    return str(cfg.output_dir)