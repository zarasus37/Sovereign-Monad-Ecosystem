# Gnosis V2 Training Log (Vector 6.1 Stage 2)

_UTC: 2026-07-21T16:28:46.544264+00:00_

**Mode:** `CPU_VERIFIED_DRY_RUN`  
**CUDA:** False  
**Base model:** `Qwen/Qwen2.5-0.5B-Instruct`  
**Pairs:** 152 (train 121 / eval 31)

## Effective hyperparams

```json
{
  "batch_size": 1,
  "learning_rate": 1e-05,
  "epochs": 1,
  "max_steps": 4,
  "max_length": 512
}
```

## Train metrics

```json
{
  "train_runtime": 135.7057,
  "train_samples_per_second": 0.029,
  "train_steps_per_second": 0.029,
  "total_flos": 3613081006080.0,
  "train_loss": 0.5641854628920555,
  "epoch": 0.037383177570093455
}
```

## Eval metrics

```json
{
  "eval_loss": 0.3887256979942322,
  "eval_runtime": 47.5771,
  "eval_samples_per_second": 0.546,
  "eval_steps_per_second": 0.546,
  "eval_num_tokens": 1204.0,
  "eval_min_reward": -0.019590336542863112,
  "eval_mean_reward": 0.6179366386853732,
  "eval_max_reward": 1.2554636184985821,
  "eval_accuracy": 0.7692307692307693,
  "eval_margin": 1.123703617316026,
  "epoch": 0.037383177570093455
}
```

## Loss curve (trainer log_history)

| step | loss | eval_loss | learning_rate |
|------|------|-----------|---------------|
| 1 | 1.1835310459136963 |  | 0.0 |
| 2 | 0.43103644251823425 |  | 1e-05 |
| 2 |  | 0.39440613985061646 |  |
| 3 | 0.48687636852264404 |  | 7.500000000000001e-06 |
| 4 | 0.15529799461364746 |  | 2.5000000000000015e-06 |
| 4 |  | 0.3887256979942322 |  |
| 4 |  | 0.3887256979942322 |  |

## Raw log_history

```json
[
  {
    "loss": 1.1835310459136963,
    "grad_norm": 25.76310920715332,
    "learning_rate": 0.0,
    "num_tokens": 177.0,
    "min_reward": 1.952759027481079,
    "mean_reward": 2.3617420196533203,
    "max_reward": 2.7707247734069824,
    "accuracy": 0.0,
    "margin": -0.8179657459259033,
    "epoch": 0.009345794392523364,
    "step": 1
  },
  {
    "loss": 0.43103644251823425,
    "grad_norm": 57.72411346435547,
    "learning_rate": 1e-05,
    "num_tokens": 330.0,
    "min_reward": 1.2729077339172363,
    "mean_reward": 1.582065224647522,
    "max_reward": 1.8912227153778076,
    "accuracy": 1.0,
    "margin": 0.6183149814605713,
    "epoch": 0.018691588785046728,
    "step": 2
  },
  {
    "eval_loss": 0.39440613985061646,
    "eval_runtime": 55.0585,
    "eval_samples_per_second": 0.472,
    "eval_steps_per_second": 0.472,
    "eval_num_tokens": 330.0,
    "eval_min_reward": -0.017561174356020413,
    "eval_mean_reward": 0.6112306530659015,
    "eval_max_reward": 1.2400224759028509,
    "eval_accuracy": 0.7692307692307693,
    "eval_margin": 1.0995177855858436,
    "epoch": 0.018691588785046728,
    "step": 2
  },
  {
    "loss": 0.48687636852264404,
    "grad_norm": 14.867148399353027,
    "learning_rate": 7.500000000000001e-06,
    "num_tokens": 538.0,
    "min_reward": 0.3715043067932129,
    "mean_reward": 0.6047289371490479,
    "max_reward": 0.8379535675048828,
    "accuracy": 1.0,
    "margin": 0.4664492607116699,
    "epoch": 0.028037383177570093,
    "step": 3
  },
  {
    "loss": 0.15529799461364746,
    "grad_norm": 21.265607833862305,
    "learning_rate": 2.5000000000000015e-06,
    "num_tokens": 1204.0,
    "min_reward": 1.860058307647705,
    "mean_reward": 2.751936197280884,
    "max_reward": 3.6438140869140625,
    "accuracy": 1.0,
    "margin": 1.7837557792663574,
    "epoch": 0.037383177570093455,
    "step": 4
  },
  {
    "eval_loss": 0.3887256979942322,
    "eval_runtime": 50.601,
    "eval_samples_per_second": 0.514,
    "eval_steps_per_second": 0.514,
    "eval_num_tokens": 1204.0,
    "eval_min_reward": -0.019590336542863112,
    "eval_mean_reward": 0.6179366386853732,
    "eval_max_reward": 1.2554636184985821,
    "eval_accuracy": 0.7692307692307693,
    "eval_margin": 1.123703617316026,
    "epoch": 0.037383177570093455,
    "step": 4
  },
  {
    "train_runtime": 135.7057,
    "train_samples_per_second": 0.029,
    "train_steps_per_second": 0.029,
    "total_flos": 3613081006080.0,
    "train_loss": 0.5641854628920555,
    "epoch": 0.037383177570093455,
    "step": 4
  },
  {
    "eval_loss": 0.3887256979942322,
    "eval_runtime": 47.5771,
    "eval_samples_per_second": 0.546,
    "eval_steps_per_second": 0.546,
    "eval_num_tokens": 1204.0,
    "eval_min_reward": -0.019590336542863112,
    "eval_mean_reward": 0.6179366386853732,
    "eval_max_reward": 1.2554636184985821,
    "eval_accuracy": 0.7692307692307693,
    "eval_margin": 1.123703617316026,
    "epoch": 0.037383177570093455,
    "step": 4
  }
]
```

**Elapsed:** 183.9s  
**Checkpoint:** `checkpoints/gnosis-v2.0-reward`
