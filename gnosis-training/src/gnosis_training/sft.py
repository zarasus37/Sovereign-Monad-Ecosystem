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


def _export_merged_model(cfg: SFTConfig, trainer: Any) -> None:
    """Merge the QLoRA SFT adapter into a full-precision base and overwrite the
    output dir with the merged model + tokenizer.

    ``SFTTrainer.save_model`` saves ONLY the LoRA adapter
    (``adapter_config.json`` + adapter weights) for a 4-bit QLoRA model — NOT a
    loadable full model (no ``config.json`` with ``model_type``). Stage 3 GRPO
    loads the SFT output as a base model under a fresh QLoRA adapter (the
    documented "QLoRA continue" design in ``grpo.py``), so it needs a full-model
    dir. The 4-bit base cannot be merged in place (quantized weights), so we
    reload the base in full precision, apply the just-saved adapter, merge, and
    save — producing ``config.json`` + ``model.safetensors`` + tokenizer.

    Transient full-precision footprint: ~1 GB at 0.5B, ~16 GB at 8B (fits a 24
    GB card; the in-memory 4-bit model is freed first). This is the standard
    "export merged model" step in a QLoRA workflow. Surfaced by the dry run (PR
    #48 first GPU execution) — without it GRPO crashes with
    ``AutoConfig.from_pretrained: Should have a model_type key in its
    config.json``.
    """
    from peft import PeftModel
    from transformers import AutoModelForCausalLM

    # Free the in-memory 4-bit model before reloading full-precision (matters at 8B).
    try:
        del trainer.model
    except AttributeError:
        pass
    try:
        import torch

        torch.cuda.empty_cache()
    except Exception:  # pragma: no cover — CUDA not always present at import time
        pass

    base = AutoModelForCausalLM.from_pretrained(cfg.base_model_id, device_map="auto")
    peft_model = PeftModel.from_pretrained(base, str(cfg.output_dir))
    merged = peft_model.merge_and_unload()
    merged.save_pretrained(str(cfg.output_dir))
    trainer.processing_class.save_pretrained(str(cfg.output_dir))

    # Remove the leftover adapter files written by ``trainer.save_model``. The
    # dir now holds the merged full model (config.json + model.safetensors); the
    # adapter_config.json + adapter_model.safetensors are stale and confuse the
    # downstream GRPO load — TRL/PEFT see adapter_config.json and load the SFT
    # dir as a PeftModel, then the fresh GRPO LoRA is applied on top ("PEFT for a
    # second time" → double-LoRA). Surfaced by the dry run (PR #50 first GPU
    # execution). Cleaning them makes the SFT dir a plain full-model dir.
    out_dir = Path(str(cfg.output_dir))
    for stale in out_dir.glob("adapter_config.json"):
        stale.unlink()
    for stale in out_dir.glob("adapter_model*.safetensors*"):
        stale.unlink()
    for stale in out_dir.glob("initial_peft_weight*.safetensors*"):
        stale.unlink()


def run_sft(cfg: SFTConfig, train_jsonl: str | Path, eval_jsonl: str | Path | None = None) -> str:
    """Build the trainer, train, save the adapter, then export the merged full
    model for downstream GRPO. GPU-only."""
    trainer = build_sft_trainer(cfg, train_jsonl, eval_jsonl)
    trainer.train()
    trainer.save_model(str(cfg.output_dir))  # adapter + tokenizer
    _export_merged_model(cfg, trainer)  # overwrite with merged full model
    return str(cfg.output_dir)