# MODEL CARD — gnosis-v2.0-reward

**Stage:** 2 RewardTrainer (Vector 6.1)  
**Checkpoint:** `checkpoints/gnosis-v2.0-reward`  
**Training date (UTC):** 2026-07-20T17:05:49.750226+00:00  
**Mode:** `CPU_VERIFIED_DRY_RUN`

## Corpus

| Field | Value |
|-------|-------|
| Trainable file | `data/preference_pairs_ALL.jsonl` |
| Human-judged pairs | **41** |
| CAT distribution | `{'CAT1': 13, 'CAT2': 10, 'CAT3': 8, 'CAT4': 9, 'CAT5': 1}` |
| CATs represented | CAT1, CAT2, CAT3, CAT4, CAT5 |
| CATs missing (vs CAT1–9) | CAT6, CAT7, CAT8, CAT9 |
| Train / eval split | 32 / 9 (80/20, seed=42) |

### Honesty on the "71 pairs / worksheet" claim

The task referenced `preference_pairs_worksheet.jsonl` with 71 pairs. On disk that
file is a **250-row bootstrap scaffold**
(250 pending authoring, empty responses).  
Training used **`preference_pairs_ALL.jsonl`** (41 human-judged pairs)
per spec line 478.

## Base model

- **ID:** `Qwen/Qwen2.5-0.5B-Instruct`
- **4-bit QLoRA:** False
- **CUDA available:** False

Production target remains `meta-llama/Llama-3.1-8B` under 4-bit QLoRA (capital-gated).
This checkpoint is the **v2.0 Stage-2 lock** on the available public tiny model
when GPU/HF Llama access is not configured.

## Hyperparameters

| | Requested | Effective |
|-|-----------|-----------|
| batch size | 8 | 1 |
| learning rate | 1e-05 | 1e-05 |
| epochs | 3 | 1 |
| max_steps | — | 4 |
| max_length | — | 512 |

## Metrics

- **Train loss (final):** 0.46249570697546005
- **Eval loss (final):** 0.3650001883506775
- **Wall time (s):** 140.0

See `training_metrics.json` and `docs/GNOSIS_V2_TRAINING_LOG.md` for full history.

## GPU / CPU status

```
mode=CPU_VERIFIED_DRY_RUN
cuda=False
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
