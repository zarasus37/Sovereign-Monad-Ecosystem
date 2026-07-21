# Gnosis V2 Training Log (Vector 6.1 Stage 2)

_UTC: 2026-07-21T16:19:54.194917+00:00_

**Mode:** `CPU_VERIFIED_DRY_RUN`  
**CUDA:** False  
**Base model:** `Qwen/Qwen2.5-0.5B-Instruct`  
**Pairs:** 128 (train 102 / eval 26)

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
  "train_runtime": 110.7233,
  "train_samples_per_second": 0.036,
  "train_steps_per_second": 0.036,
  "total_flos": 2305489784832.0,
  "train_loss": 0.8222173899412155,
  "epoch": 0.04597701149425287
}
```

## Eval metrics

```json
{
  "eval_loss": 0.34241539239883423,
  "eval_runtime": 42.5136,
  "eval_samples_per_second": 0.517,
  "eval_steps_per_second": 0.517,
  "eval_num_tokens": 883.0,
  "eval_min_reward": 0.16082926229997116,
  "eval_mean_reward": 0.8635120202194561,
  "eval_max_reward": 1.566194778138941,
  "eval_accuracy": 0.8636363636363636,
  "eval_margin": 1.2436531348661943,
  "epoch": 0.04597701149425287
}
```

## Loss curve (trainer log_history)

| step | loss | eval_loss | learning_rate |
|------|------|-----------|---------------|
| 1 | 1.5508381128311157 |  | 0.0 |
| 2 | 0.4898463785648346 |  | 1e-05 |
| 2 |  | 0.3415403664112091 |  |
| 3 | 0.42564716935157776 |  | 7.500000000000001e-06 |
| 4 | 0.822537899017334 |  | 2.5000000000000015e-06 |
| 4 |  | 0.34241539239883423 |  |
| 4 |  | 0.34241539239883423 |  |

## Raw log_history

```json
[
  {
    "loss": 1.5508381128311157,
    "grad_norm": 51.867671966552734,
    "learning_rate": 0.0,
    "num_tokens": 173.0,
    "min_reward": -1.3985376358032227,
    "mean_reward": -0.7422916889190674,
    "max_reward": -0.08604574203491211,
    "accuracy": 0.0,
    "margin": -1.3124918937683105,
    "epoch": 0.011494252873563218,
    "step": 1
  },
  {
    "loss": 0.4898463785648346,
    "grad_norm": 35.037437438964844,
    "learning_rate": 1e-05,
    "num_tokens": 387.0,
    "min_reward": -0.7494062185287476,
    "mean_reward": -0.5200250744819641,
    "max_reward": -0.29064393043518066,
    "accuracy": 1.0,
    "margin": 0.4587622880935669,
    "epoch": 0.022988505747126436,
    "step": 2
  },
  {
    "eval_loss": 0.3415403664112091,
    "eval_runtime": 46.2176,
    "eval_samples_per_second": 0.476,
    "eval_steps_per_second": 0.476,
    "eval_num_tokens": 387.0,
    "eval_min_reward": 0.1558921608057889,
    "eval_mean_reward": 0.8605316064574502,
    "eval_max_reward": 1.5651710521091113,
    "eval_accuracy": 0.8636363636363636,
    "eval_margin": 1.2480551492084155,
    "epoch": 0.022988505747126436,
    "step": 2
  },
  {
    "loss": 0.42564716935157776,
    "grad_norm": 13.636394500732422,
    "learning_rate": 7.500000000000001e-06,
    "num_tokens": 600.0,
    "min_reward": 1.0490003824234009,
    "mean_reward": 1.3658920526504517,
    "max_reward": 1.6827837228775024,
    "accuracy": 1.0,
    "margin": 0.6337833404541016,
    "epoch": 0.034482758620689655,
    "step": 3
  },
  {
    "loss": 0.822537899017334,
    "grad_norm": 20.702898025512695,
    "learning_rate": 2.5000000000000015e-06,
    "num_tokens": 883.0,
    "min_reward": 2.090070962905884,
    "mean_reward": 2.2120416164398193,
    "max_reward": 2.334012269973755,
    "accuracy": 0.0,
    "margin": -0.2439413070678711,
    "epoch": 0.04597701149425287,
    "step": 4
  },
  {
    "eval_loss": 0.34241539239883423,
    "eval_runtime": 44.3684,
    "eval_samples_per_second": 0.496,
    "eval_steps_per_second": 0.496,
    "eval_num_tokens": 883.0,
    "eval_min_reward": 0.16082926229997116,
    "eval_mean_reward": 0.8635120202194561,
    "eval_max_reward": 1.566194778138941,
    "eval_accuracy": 0.8636363636363636,
    "eval_margin": 1.2436531348661943,
    "epoch": 0.04597701149425287,
    "step": 4
  },
  {
    "train_runtime": 110.7233,
    "train_samples_per_second": 0.036,
    "train_steps_per_second": 0.036,
    "total_flos": 2305489784832.0,
    "train_loss": 0.8222173899412155,
    "epoch": 0.04597701149425287,
    "step": 4
  },
  {
    "eval_loss": 0.34241539239883423,
    "eval_runtime": 42.5136,
    "eval_samples_per_second": 0.517,
    "eval_steps_per_second": 0.517,
    "eval_num_tokens": 883.0,
    "eval_min_reward": 0.16082926229997116,
    "eval_mean_reward": 0.8635120202194561,
    "eval_max_reward": 1.566194778138941,
    "eval_accuracy": 0.8636363636363636,
    "eval_margin": 1.2436531348661943,
    "epoch": 0.04597701149425287,
    "step": 4
  }
]
```

**Elapsed:** 153.6s  
**Checkpoint:** `checkpoints/gnosis-v2.0-reward`
