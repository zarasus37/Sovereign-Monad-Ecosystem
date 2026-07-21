# Gnosis V2 Training Log (Vector 6.1 Stage 2)

_UTC: 2026-07-21T16:41:57.435242+00:00_

**Mode:** `CPU_VERIFIED_DRY_RUN`  
**CUDA:** False  
**Base model:** `Qwen/Qwen2.5-0.5B-Instruct`  
**Pairs:** 250 (train 200 / eval 50)

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
  "train_runtime": 160.2992,
  "train_samples_per_second": 0.025,
  "train_steps_per_second": 0.025,
  "total_flos": 3299087061504.0,
  "train_loss": 0.1714191772043705,
  "epoch": 0.02197802197802198
}
```

## Eval metrics

```json
{
  "eval_loss": 0.530296802520752,
  "eval_runtime": 65.8747,
  "eval_samples_per_second": 0.744,
  "eval_steps_per_second": 0.744,
  "eval_num_tokens": 1027.0,
  "eval_min_reward": 0.22136805495437312,
  "eval_mean_reward": 0.9685027964261114,
  "eval_max_reward": 1.7156375305993217,
  "eval_accuracy": 0.6938775510204082,
  "eval_margin": 0.9308829380541431,
  "epoch": 0.02197802197802198
}
```

## Loss curve (trainer log_history)

| step | loss | eval_loss | learning_rate |
|------|------|-----------|---------------|
| 1 | 0.14947010576725006 |  | 0.0 |
| 2 | 0.17455658316612244 |  | 1e-05 |
| 2 |  | 0.5411059856414795 |  |
| 3 | 0.24688464403152466 |  | 7.500000000000001e-06 |
| 4 | 0.11476537585258484 |  | 2.5000000000000015e-06 |
| 4 |  | 0.530296802520752 |  |
| 4 |  | 0.530296802520752 |  |

## Raw log_history

```json
[
  {
    "loss": 0.14947010576725006,
    "grad_norm": 22.58689308166504,
    "learning_rate": 0.0,
    "num_tokens": 162.0,
    "min_reward": 0.8689231872558594,
    "mean_reward": 1.7814197540283203,
    "max_reward": 2.6939163208007812,
    "accuracy": 1.0,
    "margin": 1.8249931335449219,
    "epoch": 0.005494505494505495,
    "step": 1
  },
  {
    "loss": 0.17455658316612244,
    "grad_norm": 27.62686538696289,
    "learning_rate": 1e-05,
    "num_tokens": 298.0,
    "min_reward": -0.21541452407836914,
    "mean_reward": 0.6130648851394653,
    "max_reward": 1.4415442943572998,
    "accuracy": 1.0,
    "margin": 1.656958818435669,
    "epoch": 0.01098901098901099,
    "step": 2
  },
  {
    "eval_loss": 0.5411059856414795,
    "eval_runtime": 67.2875,
    "eval_samples_per_second": 0.728,
    "eval_steps_per_second": 0.728,
    "eval_num_tokens": 298.0,
    "eval_min_reward": 0.2434692991023161,
    "eval_mean_reward": 0.9720771701968446,
    "eval_max_reward": 1.7006850534555864,
    "eval_accuracy": 0.6938775510204082,
    "eval_margin": 0.8824640780079122,
    "epoch": 0.01098901098901099,
    "step": 2
  },
  {
    "loss": 0.24688464403152466,
    "grad_norm": 27.515920639038086,
    "learning_rate": 7.500000000000001e-06,
    "num_tokens": 885.0,
    "min_reward": -0.39298033714294434,
    "mean_reward": 0.24344635009765625,
    "max_reward": 0.8798730373382568,
    "accuracy": 1.0,
    "margin": 1.2728533744812012,
    "epoch": 0.016483516483516484,
    "step": 3
  },
  {
    "loss": 0.11476537585258484,
    "grad_norm": 24.017210006713867,
    "learning_rate": 2.5000000000000015e-06,
    "num_tokens": 1027.0,
    "min_reward": -1.634552001953125,
    "mean_reward": -0.5810850262641907,
    "max_reward": 0.47238194942474365,
    "accuracy": 1.0,
    "margin": 2.106934070587158,
    "epoch": 0.02197802197802198,
    "step": 4
  },
  {
    "eval_loss": 0.530296802520752,
    "eval_runtime": 65.5877,
    "eval_samples_per_second": 0.747,
    "eval_steps_per_second": 0.747,
    "eval_num_tokens": 1027.0,
    "eval_min_reward": 0.22136805495437312,
    "eval_mean_reward": 0.9685027964261114,
    "eval_max_reward": 1.7156375305993217,
    "eval_accuracy": 0.6938775510204082,
    "eval_margin": 0.9308829380541431,
    "epoch": 0.02197802197802198,
    "step": 4
  },
  {
    "train_runtime": 160.2992,
    "train_samples_per_second": 0.025,
    "train_steps_per_second": 0.025,
    "total_flos": 3299087061504.0,
    "train_loss": 0.1714191772043705,
    "epoch": 0.02197802197802198,
    "step": 4
  },
  {
    "eval_loss": 0.530296802520752,
    "eval_runtime": 65.8747,
    "eval_samples_per_second": 0.744,
    "eval_steps_per_second": 0.744,
    "eval_num_tokens": 1027.0,
    "eval_min_reward": 0.22136805495437312,
    "eval_mean_reward": 0.9685027964261114,
    "eval_max_reward": 1.7156375305993217,
    "eval_accuracy": 0.6938775510204082,
    "eval_margin": 0.9308829380541431,
    "epoch": 0.02197802197802198,
    "step": 4
  }
]
```

**Elapsed:** 227.0s  
**Checkpoint:** `checkpoints/gnosis-v2.0-reward`
