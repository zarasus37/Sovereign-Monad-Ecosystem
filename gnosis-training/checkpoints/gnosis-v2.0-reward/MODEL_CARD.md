# MODEL CARD — gnosis-v2.0-reward

**Stage:** 2 RewardTrainer (Vector 6.1)  
**Checkpoint:** `checkpoints/gnosis-v2.0-reward`  
**Training date (UTC):** 2026-07-21T16:28:46.544264+00:00  
**Mode:** `CPU_VERIFIED_DRY_RUN`

## Corpus

| Field | Value |
|-------|-------|
| Trainable file | `data/preference_pairs_ALL.jsonl` |
| Human-judged pairs | **152** |
| CAT distribution | `{'CAT1': 19, 'CAT2': 16, 'CAT3': 14, 'CAT4': 15, 'CAT5': 21, 'CAT6': 17, 'CAT7': 5, 'CAT8': 10, 'CAT9': 35}` |
| CATs represented | CAT1, CAT2, CAT3, CAT4, CAT5, CAT6, CAT7, CAT8, CAT9 |
| CATs missing (vs CAT1–9) | — |
| Train / eval split | 121 / 31 (80/20, seed=42) |

### Honesty on the "71 pairs / worksheet" claim

The task referenced `preference_pairs_worksheet.jsonl` with 71 pairs. On disk that
file is a **250-row bootstrap scaffold**
(250 pending authoring, empty responses).  
Training used **`preference_pairs_ALL.jsonl`** (152 human-judged pairs)
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

- **Train loss (final):** 0.5641854628920555
- **Eval loss (final):** 0.3887256979942322
- **Wall time (s):** 183.9

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
