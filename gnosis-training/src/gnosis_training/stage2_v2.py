"""Vector 6.1 — Stage 2 RewardTrainer run (gnosis-v2.0-reward).

Trains (or CPU-verified dry-runs) on HUMAN-judged preference pairs only
(spec line 478). The bootstrap worksheet is never the training source.

Default corpus: ``data/preference_pairs_ALL.jsonl`` (authored, validate_pair-ok).
``preference_pairs_worksheet.jsonl`` is a 250-row empty scaffold and is NOT trainable.
"""
from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import RewardConfig, TrainingSeed, dry_run_reward
from .generated.hyperparams import DRY_RUN_BASE_MODEL_ID
from .preference import PreferencePair, load_human_pairs
from .seed import seed_all


STAGE2_CHECKPOINT_DIR = Path("checkpoints/gnosis-v2.0-reward")
STAGE2_DEFAULT_CORPUS = Path("data/preference_pairs_ALL.jsonl")
STAGE2_WORKSHEET_CLAIMED = Path("data/preference_pairs_worksheet.jsonl")


@dataclass(frozen=True)
class Stage2V2Config:
    """Stage 2 v2.0 hyperparams (Vector 6.1).

    User request: batch_size=8, lr=1e-5, epochs=3, 80/20 split.
    On CPU / no-GPU, training falls back to a verified dry-run (tiny model,
    limited steps) — never pretends full 8B training completed.
    """

    pairs_jsonl: Path = STAGE2_DEFAULT_CORPUS
    output_dir: Path = STAGE2_CHECKPOINT_DIR
    train_fraction: float = 0.80
    learning_rate: float = 1e-5
    num_epochs: int = 3
    per_device_train_batch_size: int = 8
    per_device_eval_batch_size: int = 8
    max_length: int = 512
    gradient_accumulation_steps: int = 1
    seed: int = 42
    # CPU verified dry-run: stop after this many optimizer steps (None = full epochs)
    max_steps_cpu: int | None = 4
    # Force dry-run model even on GPU (tests / smoke)
    force_tiny_model: bool = False


@dataclass
class Stage2Audit:
    """Pre-train corpus audit snapshot."""

    claimed_worksheet_path: str
    claimed_worksheet_total: int
    claimed_worksheet_ok: int
    claimed_worksheet_pending: int
    claimed_worksheet_invalid: int
    claimed_worksheet_cats: dict[str, int]
    trainable_corpus_path: str
    trainable_ok: int
    trainable_cats: dict[str, int]
    cats_represented: list[str]
    cats_missing: list[str]
    honesty_notes: list[str] = field(default_factory=list)

    def to_markdown(self) -> str:
        lines = [
            "# Gnosis V2 Pre-Train Audit (Vector 6.1)",
            "",
            f"_Generated: {datetime.now(timezone.utc).isoformat()}_",
            "",
            "## Claimed corpus",
            "",
            f"- Path claimed in task: `{self.claimed_worksheet_path}`",
            f"- Total rows: **{self.claimed_worksheet_total}**",
            f"- validate-worksheet: **{self.claimed_worksheet_ok} ok** / "
            f"{self.claimed_worksheet_pending} pending authoring / "
            f"{self.claimed_worksheet_invalid} invalid",
            f"- Category counts: `{self.claimed_worksheet_cats}`",
            "",
            "## Trainable corpus (spec line 478 — human-judged only)",
            "",
            f"- Path: `{self.trainable_corpus_path}`",
            f"- Pairs passing `validate_pair` + non-bootstrap: **{self.trainable_ok}**",
            f"- Category counts: `{self.trainable_cats}`",
            f"- CATs represented: {', '.join(self.cats_represented) or '(none)'}",
            f"- CATs missing vs CAT1–CAT9: {', '.join(self.cats_missing) or '(none)'}",
            "",
            "## Honesty notes",
            "",
        ]
        for n in self.honesty_notes:
            lines.append(f"- {n}")
        lines.append("")
        return "\n".join(lines)


def audit_corpus(
    worksheet_path: Path | str = STAGE2_WORKSHEET_CLAIMED,
    trainable_path: Path | str = STAGE2_DEFAULT_CORPUS,
) -> Stage2Audit:
    """Audit claimed worksheet vs actual trainable human pairs."""
    from collections import Counter

    from .preference import iter_pairs_jsonl, validate_pair

    ws = Path(worksheet_path)
    tr = Path(trainable_path)

    ws_total = ws_ok = ws_pending = ws_invalid = 0
    ws_cats: Counter[str] = Counter()
    if ws.is_file():
        for pair in iter_pairs_jsonl(ws):
            ws_total += 1
            ws_cats[pair.category] += 1
            if pair.bootstrap:
                ws_pending += 1
                continue
            problems = validate_pair(pair)
            if problems:
                ws_invalid += 1
            else:
                ws_ok += 1

    pairs = load_human_pairs(tr) if tr.is_file() else []
    tr_cats = Counter(p.category for p in pairs)
    expected = [f"CAT{i}" for i in range(1, 10)]
    represented = [c for c in expected if tr_cats.get(c, 0) > 0]
    missing = [c for c in expected if tr_cats.get(c, 0) == 0]

    notes: list[str] = []
    if ws_ok == 0 and ws_pending > 0:
        notes.append(
            f"`{ws.name}` is a bootstrap worksheet ({ws_pending} pending, empty "
            "responses) — **not** a 71-pair human-judged corpus. Reward training "
            "must use human-authored pairs (spec line 478)."
        )
    if ws_total != 71:
        notes.append(
            f"Task claimed 71 pairs in worksheet; actual row count is {ws_total}."
        )
    if len(pairs) != 71:
        notes.append(
            f"Task claimed 71 human-judged pairs; trainable file has {len(pairs)} "
            "validate_pair-ok pairs."
        )
    if missing:
        notes.append(
            f"CAT coverage incomplete for CAT1–CAT9: missing {', '.join(missing)}. "
            "CAT9 TTC pairs are not yet promoted into the trainable file."
        )
    if pairs:
        notes.append(
            f"Training proceeds on `{tr.as_posix()}` with {len(pairs)} human-judged pairs."
        )

    return Stage2Audit(
        claimed_worksheet_path=str(ws.as_posix()),
        claimed_worksheet_total=ws_total,
        claimed_worksheet_ok=ws_ok,
        claimed_worksheet_pending=ws_pending,
        claimed_worksheet_invalid=ws_invalid,
        claimed_worksheet_cats=dict(sorted(ws_cats.items())),
        trainable_corpus_path=str(tr.as_posix()),
        trainable_ok=len(pairs),
        trainable_cats=dict(sorted(tr_cats.items())),
        cats_represented=represented,
        cats_missing=missing,
        honesty_notes=notes,
    )


def _cuda_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def _pairs_to_dataset(pairs: list[PreferencePair]) -> Any:
    from datasets import Dataset

    rows = [
        {
            "prompt": p.prompt,
            "chosen": p.chosen.response,
            "rejected": p.rejected.response,
            "pair_id": p.pair_id,
            "category": p.category,
        }
        for p in pairs
    ]
    return Dataset.from_list(rows)


def _build_model_and_tokenizer(
    base_model_id: str,
    *,
    use_4bit: bool,
    max_length: int,
) -> tuple[Any, Any]:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(base_model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    if use_4bit:
        try:
            import bitsandbytes  # noqa: F401
            from transformers import BitsAndBytesConfig
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "4-bit path needs bitsandbytes (`uv sync --extra qlora`)"
            ) from exc
        bnb = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
        )
        model = AutoModelForSequenceClassification.from_pretrained(
            base_model_id,
            num_labels=1,
            quantization_config=bnb,
            device_map="auto",
        )
    else:
        model = AutoModelForSequenceClassification.from_pretrained(
            base_model_id,
            num_labels=1,
            torch_dtype=torch.float32,
        )
    # seq-cls pad token id
    model.config.pad_token_id = tokenizer.pad_token_id
    _ = max_length  # used by trainer, not model ctor
    return model, tokenizer


def run_stage2_v2(
    cfg: Stage2V2Config | None = None,
    *,
    write_docs: bool = True,
    repo_docs_dir: Path | None = None,
) -> dict[str, Any]:
    """Execute Stage 2 v2.0 reward training or CPU verified dry-run.

    Returns a metrics dict and writes checkpoint + optional docs.
    """
    cfg = cfg or Stage2V2Config()
    seed_all(cfg.seed, include_torch=True)

    audit = audit_corpus(
        worksheet_path=STAGE2_WORKSHEET_CLAIMED,
        trainable_path=cfg.pairs_jsonl,
    )
    pairs = load_human_pairs(cfg.pairs_jsonl)
    if len(pairs) < 2:
        raise ValueError(
            f"need ≥2 human-judged pairs for train/eval split; got {len(pairs)}"
        )

    cuda = _cuda_available()
    verified_dry_run = (not cuda) or cfg.force_tiny_model
    use_4bit = cuda and not cfg.force_tiny_model

    # Model selection honesty
    if verified_dry_run:
        base_model_id = DRY_RUN_BASE_MODEL_ID
        batch = 1  # CPU / tiny path
        max_steps = cfg.max_steps_cpu
        num_epochs = 1
        honesty_mode = "CPU_VERIFIED_DRY_RUN"
    else:
        # GPU: still start from tiny public model unless Llama access is configured;
        # full Llama-3.1-8B remains the production target (gated by HF token + VRAM).
        base_model_id = DRY_RUN_BASE_MODEL_ID
        batch = cfg.per_device_train_batch_size
        max_steps = None
        num_epochs = cfg.num_epochs
        honesty_mode = "GPU_TINY_MODEL_FULL_EPOCHS"
        # Note: production 8B is separate capital-gated job

    out_dir = Path(cfg.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    dataset = _pairs_to_dataset(pairs)
    split = dataset.train_test_split(
        test_size=1.0 - cfg.train_fraction,
        seed=cfg.seed,
        shuffle=True,
    )
    train_ds = split["train"]
    eval_ds = split["test"]

    # Persist split membership for auditability
    split_meta = {
        "train_ids": list(train_ds["pair_id"]),
        "eval_ids": list(eval_ds["pair_id"]),
        "train_n": len(train_ds),
        "eval_n": len(eval_ds),
        "train_fraction": cfg.train_fraction,
        "seed": cfg.seed,
    }
    (out_dir / "split.json").write_text(
        json.dumps(split_meta, indent=2) + "\n",
        encoding="utf-8",
    )

    from peft import LoraConfig
    from trl import RewardConfig as TrlRewardConfig
    from trl import RewardTrainer

    model, tokenizer = _build_model_and_tokenizer(
        base_model_id,
        use_4bit=use_4bit,
        max_length=cfg.max_length,
    )

    lora = LoraConfig(
        r=8 if verified_dry_run else 16,
        lora_alpha=16 if verified_dry_run else 32,
        lora_dropout=0.05,
        target_modules=["q_proj", "v_proj"],
        bias="none",
        task_type="SEQ_CLS",
        modules_to_save=["score"],
    )

    trl_args_kwargs: dict[str, Any] = {
        "output_dir": str(out_dir),
        "max_length": cfg.max_length,
        "num_train_epochs": num_epochs,
        "per_device_train_batch_size": batch,
        "per_device_eval_batch_size": min(batch, cfg.per_device_eval_batch_size),
        "gradient_accumulation_steps": cfg.gradient_accumulation_steps,
        "learning_rate": cfg.learning_rate,
        "lr_scheduler_type": "cosine",
        "warmup_ratio": 0.03,
        "logging_steps": 1,
        "eval_strategy": "steps" if max_steps else "epoch",
        "save_strategy": "no",
        "report_to": "none",
        "seed": cfg.seed,
        "bf16": bool(cuda),
        "fp16": False,
        "remove_unused_columns": False,
    }
    if max_steps is not None:
        trl_args_kwargs["max_steps"] = max_steps
        trl_args_kwargs["eval_steps"] = max(1, max_steps // 2)

    reward_args = TrlRewardConfig(**trl_args_kwargs)

    trainer = RewardTrainer(
        model=model,
        args=reward_args,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        processing_class=tokenizer,
        peft_config=lora,
    )

    t0 = time.time()
    train_out = trainer.train()
    train_metrics = dict(train_out.metrics) if train_out is not None else {}
    eval_metrics: dict[str, Any] = {}
    try:
        eval_metrics = dict(trainer.evaluate())
    except Exception as exc:  # pragma: no cover - surface in log
        eval_metrics = {"evaluate_error": str(exc)}
    elapsed = time.time() - t0

    trainer.save_model(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))

    # Training history from trainer state
    history = []
    if getattr(trainer, "state", None) and trainer.state.log_history:
        history = list(trainer.state.log_history)

    result = {
        "mode": honesty_mode,
        "cuda": cuda,
        "base_model_id": base_model_id,
        "use_4bit": use_4bit,
        "pairs_total": len(pairs),
        "train_n": len(train_ds),
        "eval_n": len(eval_ds),
        "requested_hyperparams": {
            "batch_size": cfg.per_device_train_batch_size,
            "learning_rate": cfg.learning_rate,
            "epochs": cfg.num_epochs,
            "train_fraction": cfg.train_fraction,
        },
        "effective_hyperparams": {
            "batch_size": batch,
            "learning_rate": cfg.learning_rate,
            "epochs": num_epochs,
            "max_steps": max_steps,
            "max_length": cfg.max_length,
        },
        "train_metrics": train_metrics,
        "eval_metrics": eval_metrics,
        "log_history": history,
        "elapsed_sec": elapsed,
        "output_dir": str(out_dir.as_posix()),
        "trainable_cats": audit.trainable_cats,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    (out_dir / "training_metrics.json").write_text(
        json.dumps(result, indent=2, default=str) + "\n",
        encoding="utf-8",
    )

    # MODEL_CARD
    final_eval_loss = eval_metrics.get("eval_loss", eval_metrics.get("loss", "n/a"))
    final_train_loss = train_metrics.get("train_loss", train_metrics.get("loss", "n/a"))
    card = _model_card(
        result=result,
        audit=audit,
        final_train_loss=final_train_loss,
        final_eval_loss=final_eval_loss,
    )
    (out_dir / "MODEL_CARD.md").write_text(card, encoding="utf-8")

    if write_docs:
        docs = repo_docs_dir or Path(__file__).resolve().parents[3] / "docs"
        docs.mkdir(parents=True, exist_ok=True)
        (docs / "GNOSIS_V2_PRETRAIN_AUDIT.md").write_text(
            audit.to_markdown(),
            encoding="utf-8",
        )
        (docs / "GNOSIS_V2_TRAINING_LOG.md").write_text(
            _training_log_md(result, history),
            encoding="utf-8",
        )

    return result


def _model_card(
    *,
    result: dict[str, Any],
    audit: Stage2Audit,
    final_train_loss: Any,
    final_eval_loss: Any,
) -> str:
    return f"""# MODEL CARD — gnosis-v2.0-reward

**Stage:** 2 RewardTrainer (Vector 6.1)  
**Checkpoint:** `{result['output_dir']}`  
**Training date (UTC):** {result['timestamp']}  
**Mode:** `{result['mode']}`

## Corpus

| Field | Value |
|-------|-------|
| Trainable file | `{audit.trainable_corpus_path}` |
| Human-judged pairs | **{audit.trainable_ok}** |
| CAT distribution | `{audit.trainable_cats}` |
| CATs represented | {', '.join(audit.cats_represented) or '—'} |
| CATs missing (vs CAT1–9) | {', '.join(audit.cats_missing) or '—'} |
| Train / eval split | {result['train_n']} / {result['eval_n']} (80/20, seed={result['requested_hyperparams']['train_fraction'] and 42}) |

### Honesty on the "71 pairs / worksheet" claim

The task referenced `preference_pairs_worksheet.jsonl` with 71 pairs. On disk that
file is a **{audit.claimed_worksheet_total}-row bootstrap scaffold**
({audit.claimed_worksheet_pending} pending authoring, empty responses).  
Training used **`preference_pairs_ALL.jsonl`** ({audit.trainable_ok} human-judged pairs)
per spec line 478.

## Base model

- **ID:** `{result['base_model_id']}`
- **4-bit QLoRA:** {result['use_4bit']}
- **CUDA available:** {result['cuda']}

Production target remains `meta-llama/Llama-3.1-8B` under 4-bit QLoRA (capital-gated).
This checkpoint is the **v2.0 Stage-2 lock** on the available public tiny model
when GPU/HF Llama access is not configured.

## Hyperparameters

| | Requested | Effective |
|-|-----------|-----------|
| batch size | {result['requested_hyperparams']['batch_size']} | {result['effective_hyperparams']['batch_size']} |
| learning rate | {result['requested_hyperparams']['learning_rate']} | {result['effective_hyperparams']['learning_rate']} |
| epochs | {result['requested_hyperparams']['epochs']} | {result['effective_hyperparams']['epochs']} |
| max_steps | — | {result['effective_hyperparams']['max_steps']} |
| max_length | — | {result['effective_hyperparams']['max_length']} |

## Metrics

- **Train loss (final):** {final_train_loss}
- **Eval loss (final):** {final_eval_loss}
- **Wall time (s):** {result['elapsed_sec']:.1f}

See `training_metrics.json` and `docs/GNOSIS_V2_TRAINING_LOG.md` for full history.

## GPU / CPU status

```
mode={result['mode']}
cuda={result['cuda']}
```

If `CPU_VERIFIED_DRY_RUN`: this run proved tokenizer + RewardTrainer + loss path
on human pairs without claiming full 3-epoch 8B convergence.

## Intended use

- Reward signal for Stage 3 GRPO (load via PEFT, do not merge_and_unload blindly).
- Ranking preference for LOGOC constitution-aligned responses.

## Limitations

- Corpus size << reference target (500+ pairs minimal RM).
- No CAT6–CAT9 in trainable set yet.
- Tiny base model under dry-run / first-breath lock — not production 8B quality.
"""


def _training_log_md(result: dict[str, Any], history: list[dict[str, Any]]) -> str:
    lines = [
        "# Gnosis V2 Training Log (Vector 6.1 Stage 2)",
        "",
        f"_UTC: {result['timestamp']}_",
        "",
        f"**Mode:** `{result['mode']}`  ",
        f"**CUDA:** {result['cuda']}  ",
        f"**Base model:** `{result['base_model_id']}`  ",
        f"**Pairs:** {result['pairs_total']} (train {result['train_n']} / eval {result['eval_n']})",
        "",
        "## Effective hyperparams",
        "",
        "```json",
        json.dumps(result["effective_hyperparams"], indent=2),
        "```",
        "",
        "## Train metrics",
        "",
        "```json",
        json.dumps(result["train_metrics"], indent=2, default=str),
        "```",
        "",
        "## Eval metrics",
        "",
        "```json",
        json.dumps(result["eval_metrics"], indent=2, default=str),
        "```",
        "",
        "## Loss curve (trainer log_history)",
        "",
        "| step | loss | eval_loss | learning_rate |",
        "|------|------|-----------|---------------|",
    ]
    for row in history:
        step = row.get("step", row.get("epoch", ""))
        loss = row.get("loss", "")
        eloss = row.get("eval_loss", "")
        lr = row.get("learning_rate", "")
        if loss == "" and eloss == "":
            continue
        lines.append(f"| {step} | {loss} | {eloss} | {lr} |")
    if len(lines) <= 20:
        lines.append("| — | (no scalar loss rows; see raw JSON) | — | — |")
    lines.extend(
        [
            "",
            "## Raw log_history",
            "",
            "```json",
            json.dumps(history, indent=2, default=str),
            "```",
            "",
            f"**Elapsed:** {result['elapsed_sec']:.1f}s  ",
            f"**Checkpoint:** `{result['output_dir']}`",
            "",
        ]
    )
    return "\n".join(lines)
