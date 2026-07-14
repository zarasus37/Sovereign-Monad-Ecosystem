"""CLI entry: ``python -m gnosis_training <mode>``.

Modes:
  - ``sft <train_jsonl> [--dry-run]``  — run Stage 1 SFT (GPU-only). Without
    ``--dry-run`` this is a documented future GPU job (no execution). With
    ``--dry-run`` it executes the REAL QLoRA SFT path on a tiny model
    (Qwen2.5-0.5B) to verify the pipeline.
  - ``reward <preference_pairs_jsonl> [--dry-run]`` — Stage 2 reward model.
  - ``grpo <train_jsonl> [--dry-run]`` — Stage 3 GRPO (GPU-only).
  - ``eval [--dry-run]``               — Stage 4 eval battery (GPU-only).
  - ``dry-run``                        — run the FULL chain (sft → reward → grpo
    → eval) on the dry-run preset + prepped feedstock. GPU-only. One command.
    See ``docs/gnosis-training/DRY_RUN_RUNBOOK.md``.
  - ``synth-pairs <events_jsonl> <out_jsonl>`` — build the dry-run SYNTHETIC
    preference pairs (CPU-pure; NOT a training path, NOT human judgments).
  - ``bootstrap-worksheet <events_jsonl> <out_jsonl>`` — emit the preference-pair
    worksheet (CPU-pure; NOT a training path).
  - ``--smoke-imports``                — the honest "wiring resolves" proof:
    lazy-import each heavy module, print versions, exit non-zero with an
    install hint on failure. Does NOT load a model or touch CUDA.

HONESTY: the ``--dry-run`` flag + ``dry-run`` mode are the ONLY paths that
execute a forward pass. They run on a tiny model + SYNTHETIC preference labels
(``synth_pairs.py``) to verify the pipeline end-to-end — they do NOT prove the
model learns the constitution. The real 8B run with HUMAN-judged preference
pairs (spec line 478) remains a future GPU job; the bare ``sft``/``reward``/
``grpo``/``eval`` modes (without ``--dry-run``) stay no-ops.
"""
from __future__ import annotations

import os
import sys
from typing import Any

# Set PYTHONHASHSEED before any heavy import for dict-iteration determinism
# (defense-in-depth alongside seed.py; best-effort when set after start).
os.environ.setdefault("PYTHONHASHSEED", "42")


def smoke_imports() -> int:
    """Lazy-import each heavy module and print its version. Exit 0 if all
    resolve, non-zero with an install hint otherwise. No model load, no CUDA."""
    checks: list[tuple[str, str]] = [
        ("torch", "torch"),
        ("transformers", "transformers"),
        ("trl", "trl"),
        ("peft", "peft"),
        ("datasets", "datasets"),
        ("accelerate", "accelerate"),
        ("numpy", "numpy"),
    ]
    failures: list[str] = []
    for module_name, import_name in checks:
        try:
            mod: Any = __import__(import_name)
            version = getattr(mod, "__version__", "?")
            print(f"gnosis_training.smoke: {module_name}={version} — OK")
        except ImportError as exc:
            print(f"gnosis_training.smoke: {module_name} FAILED ({exc})")
            failures.append(module_name)

    # bitsandbytes is the opt-in `qlora` extra — its absence is NOT a smoke
    # failure (the 4-bit kernel is hard on native Windows; the builder raises a
    # documented error when it is actually needed).
    try:
        import bitsandbytes   # noqa: F401

        print("gnosis_training.smoke: bitsandbytes (qlora extra) — OK")
    except ImportError:
        print(
            "gnosis_training.smoke: bitsandbytes (qlora extra) — NOT INSTALLED "
            "(optional; run `uv sync --extra qlora` for the 4-bit run)"
        )

    if failures:
        print(
            "\nsmoke-imports FAILED for: " + ", ".join(failures) +
            "\nrun `uv sync` to install the core ML stack."
        )
        return 1
    print("\nsmoke-imports OK — real TRL wiring resolves. No training executed.")
    return 0


def bootstrap_worksheet(events_jsonl: str, out_jsonl: str) -> int:
    """Emit the preference-pair bootstrap worksheet (CPU-pure, NOT training)."""
    from .dataset import read_events_jsonl
    from .preference import build_bootstrap_worksheet, export_pairs_for_review

    events = read_events_jsonl(events_jsonl)
    pairs = build_bootstrap_worksheet(events)
    export_pairs_for_review(pairs, out_jsonl)
    print(
        f"wrote {len(pairs)} bootstrap worksheet pairs to {out_jsonl} "
        "(marked bootstrap=True; human authoring required before RM training — spec line 478)"
    )
    return 0


def synth_pairs(events_jsonl: str, out_jsonl: str) -> int:
    """Build the dry-run SYNTHETIC preference pairs (CPU-pure, NOT training,
    NOT human judgments — see synth_pairs.py)."""
    from .dataset import read_events_jsonl
    from .synth_pairs import build_dry_run_pairs, export_dry_run_pairs

    events = read_events_jsonl(events_jsonl)
    pairs = build_dry_run_pairs(events)
    if not pairs:
        print(f"no events in {events_jsonl} → no dry-run pairs produced")
        return 1
    export_dry_run_pairs(pairs, out_jsonl)
    print(
        f"wrote {len(pairs)} dry-run SYNTHETIC pairs to {out_jsonl} "
        "(bootstrap=False, validate_pair-passing; NOT human judgments — "
        "spec line 478 still governs the real reward-model training)"
    )
    return 0


def _flag(args: list[str], flag: str) -> tuple[list[str], bool]:
    """Pop a boolean flag from args; return (remaining, present)."""
    if flag in args:
        rest = [a for a in args if a != flag]
        return rest, True
    return args, False


def _run_sft_dry(train_jsonl: str) -> int:
    from .config import dry_run_sft
    from .sft import run_sft

    cfg = dry_run_sft()
    out = run_sft(cfg, train_jsonl)
    print(f"[dry-run] SFT done — checkpoint: {out}")
    return 0


def _run_reward_dry(pairs_jsonl: str) -> int:
    from .config import dry_run_reward
    from .reward import run_reward

    cfg = dry_run_reward()
    out = run_reward(cfg, pairs_jsonl)
    print(f"[dry-run] Reward done — checkpoint: {out}")
    return 0


def _run_grpo_dry(train_jsonl: str) -> int:
    from .config import dry_run_grpo
    from .grpo import run_grpo

    cfg = dry_run_grpo()
    out = run_grpo(cfg, train_jsonl)
    print(f"[dry-run] GRPO done — checkpoint: {out}")
    return 0


def _run_eval_dry() -> int:
    from .config import dry_run_eval
    from .eval import run_eval_battery

    report = run_eval_battery(dry_run_eval())
    print(f"[dry-run] Eval done — passed={report['passed']} total_mae={report['total_mae']} "
          f"total_r2={report['total_r2']}")
    return 0


def run_dry_run_chain(train_jsonl: str, pairs_jsonl: str) -> int:
    """Run the full dry-run chain: sft → reward → grpo → eval. GPU-only.

    This is the one-command pipeline-verification entry point (see the runbook).
    Each stage uses the dry-run config (tiny model + tiny sizes); the GRPO +
    eval stages read the sft/reward dryrun checkpoints. Real gradients flow;
    the synth preference pairs (NOT human judgments) drive the reward stage.
    """
    rc = _run_sft_dry(train_jsonl)
    if rc:
        return rc
    rc = _run_reward_dry(pairs_jsonl)
    if rc:
        return rc
    rc = _run_grpo_dry(train_jsonl)
    if rc:
        return rc
    return _run_eval_dry()


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])

    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return 0

    mode = args[0]
    rest = args[1:]

    if mode == "--smoke-imports":
        return smoke_imports()

    if mode == "bootstrap-worksheet":
        if len(rest) < 2:
            print("usage: python -m gnosis_training bootstrap-worksheet <events_jsonl> <out_jsonl>")
            return 2
        return bootstrap_worksheet(rest[0], rest[1])

    if mode == "synth-pairs":
        if len(rest) < 2:
            print("usage: python -m gnosis_training synth-pairs <events_jsonl> <out_jsonl>")
            return 2
        return synth_pairs(rest[0], rest[1])

    if mode == "dry-run":
        if len(rest) < 2:
            print("usage: python -m gnosis_training dry-run <train_events_jsonl> <synth_pairs_jsonl>")
            return 2
        return run_dry_run_chain(rest[0], rest[1])

    if mode in ("sft", "reward", "grpo", "eval"):
        rest, is_dry = _flag(rest, "--dry-run")
        if not is_dry:
            print(
                f"mode '{mode}' is real TRL wiring but is a future GPU job — not executed "
                "(no model load, no training). Add --dry-run to run it on the tiny-model "
                "preset, or run on a GPU box with `uv sync --extra qlora` after the "
                "feedstock + human-judged preference pairs are ready (spec line 478)."
            )
            return 0
        # --dry-run: execute the real QLoRA path on the tiny model.
        if mode == "sft":
            if len(rest) < 1:
                print("usage: python -m gnosis_training sft <train_jsonl> --dry-run")
                return 2
            return _run_sft_dry(rest[0])
        if mode == "reward":
            if len(rest) < 1:
                print("usage: python -m gnosis_training reward <pairs_jsonl> --dry-run")
                return 2
            return _run_reward_dry(rest[0])
        if mode == "grpo":
            if len(rest) < 1:
                print("usage: python -m gnosis_training grpo <train_jsonl> --dry-run")
                return 2
            return _run_grpo_dry(rest[0])
        if mode == "eval":
            return _run_eval_dry()

    print(f"unknown mode {mode!r}; --help for usage.")
    return 2


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())