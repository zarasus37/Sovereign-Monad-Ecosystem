# Gnosis V2 Training Log (Vector 6.1 Stage 2)

_UTC: 2026-07-21T15:38:22.555990+00:00_

**Mode:** `CPU_VERIFIED_DRY_RUN`  
**CUDA:** False  
**Base model:** `Qwen/Qwen2.5-0.5B-Instruct`  
**Pairs:** 76 (train 60 / eval 16)

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
  "train_runtime": 84.7481,
  "train_samples_per_second": 0.047,
  "train_steps_per_second": 0.047,
  "total_flos": 4929274801152.0,
  "train_loss": 0.581119678914547,
  "epoch": 0.0851063829787234
}
```

## Eval metrics

```json
{
  "eval_loss": 0.6398069262504578,
  "eval_runtime": 24.551,
  "eval_samples_per_second": 0.407,
  "eval_steps_per_second": 0.407,
  "eval_num_tokens": 1698.0,
  "eval_min_reward": 0.2100100040435791,
  "eval_mean_reward": 0.7767584562301636,
  "eval_max_reward": 1.343506896495819,
  "eval_accuracy": 0.5,
  "eval_margin": 0.47355066537857055,
  "epoch": 0.0851063829787234
}
```

## Loss curve (trainer log_history)

| step | loss | eval_loss | learning_rate |
|------|------|-----------|---------------|
| 1 | 0.39458614587783813 |  | 0.0 |
| 2 | 0.4905359447002411 |  | 1e-05 |
| 2 |  | 0.644271969795227 |  |
| 3 | 0.48990583419799805 |  | 7.500000000000001e-06 |
| 4 | 0.9494507908821106 |  | 2.5000000000000015e-06 |
| 4 |  | 0.6398069262504578 |  |
| 4 |  | 0.6398069262504578 |  |

## Raw log_history

```json
[
  {
    "loss": 0.39458614587783813,
    "grad_norm": 45.24409484863281,
    "learning_rate": 0.0,
    "num_tokens": 610.0,
    "min_reward": 1.1313047409057617,
    "mean_reward": 1.494377613067627,
    "max_reward": 1.8574504852294922,
    "accuracy": 1.0,
    "margin": 0.7261457443237305,
    "epoch": 0.02127659574468085,
    "step": 1
  },
  {
    "loss": 0.4905359447002411,
    "grad_norm": 51.80137634277344,
    "learning_rate": 1e-05,
    "num_tokens": 1246.0,
    "min_reward": 1.7505160570144653,
    "mean_reward": 1.9790074825286865,
    "max_reward": 2.207498788833618,
    "accuracy": 1.0,
    "margin": 0.45698273181915283,
    "epoch": 0.0425531914893617,
    "step": 2
  },
  {
    "eval_loss": 0.644271969795227,
    "eval_runtime": 23.9552,
    "eval_samples_per_second": 0.417,
    "eval_steps_per_second": 0.417,
    "eval_num_tokens": 1246.0,
    "eval_min_reward": 0.22485265731811524,
    "eval_mean_reward": 0.7849110722541809,
    "eval_max_reward": 1.3449694871902467,
    "eval_accuracy": 0.5,
    "eval_margin": 0.4548292636871338,
    "epoch": 0.0425531914893617,
    "step": 2
  },
  {
    "loss": 0.48990583419799805,
    "grad_norm": 17.33121109008789,
    "learning_rate": 7.500000000000001e-06,
    "num_tokens": 1504.0,
    "min_reward": 0.3927488327026367,
    "mean_reward": 0.6220532059669495,
    "max_reward": 0.8513575792312622,
    "accuracy": 1.0,
    "margin": 0.4586087465286255,
    "epoch": 0.06382978723404255,
    "step": 3
  },
  {
    "loss": 0.9494507908821106,
    "grad_norm": 31.97020721435547,
    "learning_rate": 2.5000000000000015e-06,
    "num_tokens": 1698.0,
    "min_reward": -1.9364451169967651,
    "mean_reward": -1.7063770294189453,
    "max_reward": -1.476308822631836,
    "accuracy": 0.0,
    "margin": -0.4601362943649292,
    "epoch": 0.0851063829787234,
    "step": 4
  },
  {
    "eval_loss": 0.6398069262504578,
    "eval_runtime": 24.9257,
    "eval_samples_per_second": 0.401,
    "eval_steps_per_second": 0.401,
    "eval_num_tokens": 1698.0,
    "eval_min_reward": 0.2100100040435791,
    "eval_mean_reward": 0.7767584562301636,
    "eval_max_reward": 1.343506896495819,
    "eval_accuracy": 0.5,
    "eval_margin": 0.47355066537857055,
    "epoch": 0.0851063829787234,
    "step": 4
  },
  {
    "train_runtime": 84.7481,
    "train_samples_per_second": 0.047,
    "train_steps_per_second": 0.047,
    "total_flos": 4929274801152.0,
    "train_loss": 0.581119678914547,
    "epoch": 0.0851063829787234,
    "step": 4
  },
  {
    "eval_loss": 0.6398069262504578,
    "eval_runtime": 24.551,
    "eval_samples_per_second": 0.407,
    "eval_steps_per_second": 0.407,
    "eval_num_tokens": 1698.0,
    "eval_min_reward": 0.2100100040435791,
    "eval_mean_reward": 0.7767584562301636,
    "eval_max_reward": 1.343506896495819,
    "eval_accuracy": 0.5,
    "eval_margin": 0.47355066537857055,
    "epoch": 0.0851063829787234,
    "step": 4
  }
]
```

**Elapsed:** 109.6s  
**Checkpoint:** `checkpoints/gnosis-v2.0-reward`
