#!/usr/bin/env bash
# Layer 7 dry run — one command. Exercises the REAL SFT → Reward → GRPO → Eval
# pipeline end-to-end on a tiny model (Qwen2.5-0.5B-Instruct) + 4-bit QLoRA +
# synthetic preference labels, on a cheap GPU, in <30 min for ~$0–2.
#
# See docs/gnosis-training/DRY_RUN_RUNBOOK.md for the cloud-GPU rental steps +
# what "dry run passes" means (pipeline executes + eval emits real numbers —
# NOT that the model learns the constitution).
#
# GPU-ONLY. bitsandbytes 4-bit QLoRA is CUDA-only; this will fail on a CPU box.
#
# Run from the repo root:  bash gnosis-training/scripts/dry-run.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "==> 1/4  Building TS dist (scheduler + gnosis-training-data)..."
pnpm --filter @sovereign/scheduler build
pnpm --filter @sovereign/gnosis-training-data build

echo "==> 2/4  Preparing dry-run feedstock (16 train + 8 test gnosis events)..."
node gnosis-training/scripts/prepare-feedstock.mjs

echo "==> 3/4  Building dry-run synthetic preference pairs (CPU-pure)..."
cd gnosis-training
uv run python -m gnosis_training synth-pairs data/gnosis-events-train.jsonl data/dry-run-pairs.jsonl

echo "==> 4/4  Installing QLoRA extra + running the full dry-run chain (GPU)..."
uv sync --extra qlora
uv run python -m gnosis_training dry-run data/gnosis-events-train.jsonl data/dry-run-pairs.jsonl

echo
echo "==> Dry run complete. Checkpoints + eval report under gnosis-training/dryrun/."