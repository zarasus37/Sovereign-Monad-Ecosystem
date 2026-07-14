# `@sovereign/gnosis-training` — TTCL Layer 7 Training Pipeline

> **Honesty posture (read this first).** This package is **real TRL wiring** —
> `SFTTrainer` / `RewardTrainer` / `GRPOTrainer` + QLoRA configs as runnable
> Python code, import-smoke-verified. **No training is executed in this PR.**
> No GPU, no forward pass, no model load, no weight download. The
> LLaMA 3.1 8B + QLoRA run is an **explicitly-future GPU job** — deliberately
> not stubbed (stubbing would be fake-completion). The spec
> (`theo-techno-cosmo/plex/archive/TTCL_v1_0_BREAKDOWN.md:275-311`) names a real
> ML job that this package wires but does not yet run.

This is the **TTCL/compiler-axis Layer 7** training pipeline — **not** the MOF
15-layer Base Stack Layer 7, and **not** `gnostic-engine` (the Stokes-coherence
behavioral evaluator — a different "gnosis"). It is a sibling uv package to
`gnostic-engine/`, kept separate so the heavy ML stack (torch / transformers /
trl / peft / datasets / accelerate) does not bloat the parity-tested
`gnostic-engine` and its vitest subprocess shim.

## What it consumes

The JSONL feedstock produced by `@sovereign/gnosis-training-data`
(`monad-ecosystem/packages/gnosis-training-data`) — one **Gnosis training
event** per accepted schedule step, with the `assistant` message emitted empty
(it is the SFT training target, produced downstream). The Python trainer
reads that JSONL as a **filesystem / data dependency** (not a workspace
import — there is no package cycle).

## The four stages (spec §Layer 7)

1. **SFT** on gnosis events — `src/gnosis_training/sft.py` (`SFTTrainer` + QLoRA).
2. **Reward Model** on **human-judged** preference pairs (spec line 478) —
   `src/gnosis_training/reward.py` (`RewardTrainer` + scalar head).
3. **GRPO Alignment** of the SFT model against the reward model —
   `src/gnosis_training/grpo.py` (`GRPOTrainer` + `GRPOConfig`). GRPO (Group
   Relative Policy Optimization) is the PPO-family optimizer that drops the
   learned value model in favor of a group-relative baseline from N completions
   per prompt — the higher-standard Stage-3 choice for a reward-model-driven
   constitutional architecture (the DeepSeek-R1 / Qwen optimizer; see the
   doctrinal NOTE at `TTCL_v1_0_BREAKDOWN.md:302`).
4. **Evaluation Battery** — `src/gnosis_training/eval.py` + `metrics.py`.

## Honesty details (load-bearing)

- **Preference pairs.** The reward model trains on **human-judged** preference
  pairs (spec line 478), **not** on the auto-generated scaffold.
  `src/gnosis_training/preference.py` builds a **bootstrap worksheet** — pairs
  in the exact schema of `theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py`,
  marked `bootstrap: true`, with empty `assistant` responses to be filled (or
  flipped) by a human. It is a worksheet, **not ground truth**.
- **`constitution_score`** (from the data-gen consumer) is **not** the reward
  model's label and **not** a GRPO reward. It seeds the bootstrap worksheet's
  rubric scores and gates SFT inclusion via `passes` (a concretization grounded
  in spec lines 172 + 294, which describe SFT input as "constitution-verified
  samples" — the spec never explicitly says `passes` is the gate).
- **W&B / MLflow / DVC** are spec-named (TRACKING / REGISTRY / VERSIONING) but
  **wired-but-deferred** behind opt-in extras (`uv sync --extra tracking`,
  `--extra dvc`). `tracking.py` / `registry.py` raise a documented
  deferred-integration error until enabled. This keeps the CPU import-smoke
  and local pytest run from pulling GBs of tracking tooling.
- **Spec silences → concretizations.** The spec fixes only: LLaMA 3.1 8B,
  QLoRA 4-bit rank=64, AdamW lr=2e-4 cosine warmup 3%, TRL. Everything else
  (batch size, context length, epochs, grad accumulation, LoRA α/dropout/
  target_modules, all GRPO hyperparams, reward-head architecture, seed,
  eval thresholds) is **concretized on the nearest written evidence** in
  `src/gnosis_training/generated/hyperparams.py` + `config.py`, and documented
  there as concretization, not spec-mandated.
- **TRL version (modern, no upper cap).** `pyproject.toml` requires `trl>=0.15`.
  The spec's Stage-3 optimizer is **GRPO** (doctrinal upgrade from PPO — see the
  NOTE at `TTCL_v1_0_BREAKDOWN.md:302`). GRPO is the maintained PPO-family path
  in modern TRL: TRL **removed** the PPO stack (`PPOConfig`/`PPOTrainer`) after
  the 0.12–0.13 PPOv2 window (gone by 0.14+ and all 1.x, where
  SFT/Reward/GRPO/DPO/KTO remain). `grpo.py` targets the modern
  `GRPOTrainer`/`GRPOConfig` constructor signature (`reward_funcs` = the Stage-2
  reward model; `quantization_config` + `peft_config` for QLoRA continue; no
  value model — group-relative baseline), so the package pins to modern TRL with
  **no upper cap**: `uv sync` resolves `trl==1.8.0`, where
  SFT/Reward/GRPO config+trainer are all genuinely importable and the GRPO
  wiring is runnable (spec-faithful — the doctrinal upgrade is surfaced in the
  spec, not a silent substitution). SFT + Reward run on this line too.

## Local verification (Python tests are LOCAL-ONLY — not in CI)

CI (`.github/workflows/ci.yml`) is Node/pnpm-only (`pnpm check:layout`);
mirroring `gnostic-engine`, this package's pytest suite is run locally:

```bash
cd gnosis-training
uv sync                      # pulls a ~3–5GB ML stack; see "Install size" below
uv run ruff check src/        # lint
uv run mypy src/              # strict typecheck on the CPU-pure surface
uv run pytest tests/ -v       # CPU-pure tests GREEN; heavy-dep tests green or SKIPPED
uv run python -m gnosis_training --smoke-imports   # the honest "wiring resolves" proof
```

The `--smoke-imports` CLI mode lazy-imports each heavy module, prints its
version, and exits non-zero with an install hint if any import fails. It does
**not** instantiate a model, load weights, or touch CUDA — it only proves the
TRL wiring resolves on the installed stack.

### Install size

`torch + transformers + trl + peft + datasets + accelerate` is ~3–5 GB on
Windows. To avoid pulling CUDA wheels by default on a CPU-only box, prefer a
CPU torch index, e.g.:

```bash
uv sync --extra-index-url https://download.pytorch.org/whl/cpu
```

W&B / MLflow / DVC are **not** installed by a plain `uv sync` — use
`uv sync --extra tracking` / `--extra dvc` to opt in.

## Test posture

`pytest.importorskip` guards every test that needs a heavy dep, so the suite
is honestly **GREEN with SKIPS** when the ML stack is not installed locally —
the CPU-pure tests (`config`, `event`, `metrics`, `seed`, `preference`) run
regardless; `test_dataset` skips without `datasets`; `test_smoke_imports`
skips without the full ML stack. Skips are honest, not fake.