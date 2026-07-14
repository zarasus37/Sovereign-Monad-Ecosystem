# Layer 7 Dry-Run Runbook

Execute the **real** Layer 7 training pipeline (SFT → Reward → GRPO → Eval) end-to-end on a **cheap cloud GPU** behind a tiny-model preset, for ~$0–2 in <30 min — to catch config/data/wiring bugs before the real 8B run.

This is the "verify from built state" discipline applied at the pipeline level: the dry run is **real execution** (real gradients, real eval numbers), not a stub. It is **not** a claim that the model learns the constitution.

## What the dry run proves

- The full QLoRA + GRPO code path (`sft.py` / `reward.py` / `grpo.py` / `eval.py`) executes end-to-end without crashing on a real GPU.
- The Layer 6 → Layer 7 feedstock path (`generateSchedule` → `generateGnosisEvents` → passes-gate) yields trainable JSONL.
- The synthetic preference pairs (`synth_pairs.py`) pass `validate_pair` and drive the reward trainer.
- Each stage writes a checkpoint dir; the eval battery emits a real `total_mae` / `total_r2` / `coherence` report.

## What the dry run does NOT prove

- That the model learns the constitution. The preference labels are **synthetic stand-ins** (`synth_pairs.py`), **not human judgments** (spec line 478 still governs the real reward-model training). The `assistant` content in the feedstock is empty (the data-gen producer emits the target empty).
- Any quality bar on the eval numbers. "Pass" = the pipeline runs and emits numbers, **not** that `total_mae ≤ 0.08` or `total_r2 ≥ 0.6`.

## Honesty posture (load-bearing — do not regress)

- The bare `sft` / `reward` / `grpo` / `eval` CLI modes (without `--dry-run`) stay **no-ops** that print "future GPU job" and return 0. The real 8B run with human-judged preference pairs remains a future, capital-gated GPU job.
- The dry run is opt-in via `--dry-run` or the `dry-run` orchestration mode. The synth pairs are clearly labelled `dry-run` in their `notes` field and are never on the human-judgment path.

## 1. Rent a cloud GPU

The dry run needs a CUDA GPU with ≥16 GB VRAM (Qwen2.5-0.5B under 4-bit QLoRA is ~1 GB; the GRPO group-2 + full-precision reward load fit comfortably in 16 GB; 24 GB is the comfortable default). Any modern NVIDIA datacenter GPU works (A10g, A100, RTX 4090, L4).

Recommended options (cheapest first):

- **RunPod** — RTX 4090 on-demand ~$0.40/hr, or A10g ~$0.75/hr. Pick a template with CUDA 12 + Python 3.11+, or use the PyTorch template. <https://www.runpod.io>
- **Lambda Cloud** — A10g ~$0.75/hr. <https://lambdalabs.com>
- **Google Colab Pro** — A100 available on the free-ish tier; fine for a one-off but timeouts can interrupt a 20-min run. Use only if you don't want to set up a box.

The dry run is short: a single 20–30 min session is plenty. Budget ~$0–2.

## 2. Clone + set up on the GPU box

```bash
git clone <repo-url> the-sovereign
cd the-sovereign
# Node (for the TS feedstock step) + pnpm + uv (Python).
corepack enable pnpm          # or: npm i -g pnpm@9.6.0
pnpm install                   # workspace deps (frozen lockfile)
# Python env for gnosis-training (uses uv.lock — do NOT regenerate it).
cd gnosis-training
uv sync                        # core ML stack (torch, transformers, trl, peft, datasets)
```

> **OneDrive warning (local Windows only):** on a Windows box synced via OneDrive, `uv sync` can corrupt the `.venv` mid-install (a `dist-info` dir gets locked). The cloud box is not on OneDrive, so this does not apply there. If you ever run locally, delete the stale `.venv` and re-run `UV_LINK_MODE=copy uv sync`.

## 3. Run the dry run (one command)

From the repo root:

```bash
bash gnosis-training/scripts/dry-run.sh
```

The script does four things in order:

1. Builds the TS `dist/` for `@sovereign/scheduler` + `@sovereign/gnosis-training-data`.
2. Runs `prepare-feedstock.mjs` → `gnosis-training/data/gnosis-events-train.jsonl` (16 passing events) + `gnosis-training/data/gnosis-events-test.jsonl` (8 passing events).
3. Runs `python -m gnosis_training synth-pairs` → `gnosis-training/data/dry-run-pairs.jsonl` (synthetic preference pairs, CPU-pure).
4. `uv sync --extra qlora` (installs `bitsandbytes`) then `python -m gnosis_training dry-run` — the full chain (sft → reward → grpo → eval) on the tiny model.

To run a single stage instead of the whole chain:

```bash
cd gnosis-training
uv run python -m gnosis_training sft data/gnosis-events-train.jsonl --dry-run
uv run python -m gnosis_training reward data/dry-run-pairs.jsonl --dry-run
uv run python -m gnosis_training grpo --dry-run
uv run python -m gnosis_training eval --dry-run
```

## 4. Expected output

Each stage prints its checkpoint dir + a `[dry-run]` marker, e.g.:

```
[dry-run] SFT done — checkpoint: dryrun/sft
[dry-run] Reward done — checkpoint: dryrun/reward
[dry-run] GRPO done — checkpoint: dryrun/grpo
[dry-run] Eval done — passed=<bool> total_mae=<float> total_r2=<float>
```

Four dirs appear under `gnosis-training/dryrun/`: `sft/`, `reward/`, `grpo/`, `eval/`. The eval report (`dryrun/eval/`) carries the real `total_mae`, `total_r2`, and `coherence` numbers.

**Pass = the script exits 0 and the eval line prints real floats** (not that they meet the real-run thresholds). A crash anywhere in the chain is a real wiring/config/data bug the dry run was built to surface — fix it here, cheaply, before the 8B run.

## 5. Known surface the dry run surfaces (does not fix)

`grpo.py` loads the reward model **full-precision** (no 4-bit) — fine at 0.5B, a real-run concern at 8B (it would roughly double the GRPO-stage VRAM). The dry run exercises this path and will confirm whether it fits your rented GPU; the fix (4-bit the reward load in GRPO) is a separate follow-up, deliberately not folded into the dry-run PR.

## 6. Real-run follow-up (out of scope, capital-gated)

- The real 8B GPU run on LLaMA 3.1 8B + 4-bit QLoRA (the full `SFTConfig` / `RewardConfig` / `GRPOConfig` / `EvalConfig` defaults).
- **Human-judged** preference-pair authoring (spec line 478 — a human job; `build_bootstrap_worksheet` emits the empty-response worksheet that a human fills in). The real reward model trains on `load_human_pairs`, never on `synth_pairs`.
- Fixing `grpo.py`'s full-precision reward-model load.
- A richer `labels` shape for the P/T/V/Q/E wheels (Layer 6 follow-up).