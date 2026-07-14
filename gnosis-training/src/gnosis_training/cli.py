"""CLI entry: ``python -m gnosis_training <mode>``.

Modes:
  - ``sft <train_jsonl>``            — run Stage 1 SFT (GPU-only; future job).
  - ``reward <preference_pairs_jsonl>`` — run Stage 2 reward model (GPU-only).
  - ``grpo``                         — run Stage 3 GRPO (GPU-only).
  - ``eval``                         — run Stage 4 eval battery (GPU-only).
  - ``bootstrap-worksheet <events_jsonl> <out_jsonl>`` — emit the preference-pair
    worksheet (CPU-pure; NOT a training path).
  - ``--smoke-imports``              — the honest "wiring resolves" proof:
    lazy-import each heavy module, print versions, exit non-zero with an
    install hint on failure. Does NOT load a model or touch CUDA.

The ``--smoke-imports`` mode is the ONLY GPU-adjacent verification performed in
this PR. The training subcommands are real but are explicitly future GPU jobs
(nothing here executes a forward pass).
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


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])

    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return 0

    mode = args[0]

    if mode == "--smoke-imports":
        return smoke_imports()

    if mode == "bootstrap-worksheet":
        if len(args) < 3:
            print("usage: python -m gnosis_training bootstrap-worksheet <events_jsonl> <out_jsonl>")
            return 2
        return bootstrap_worksheet(args[1], args[2])

    if mode in ("sft", "reward", "grpo", "eval"):
        print(
            f"mode '{mode}' is real TRL wiring but is a future GPU job — not executed "
            "in this PR (no model load, no training). Run it on a GPU box with "
            "`uv sync --extra qlora` after the feedstock + preference pairs are ready."
        )
        return 0

    print(f"unknown mode {mode!r}; --help for usage.")
    return 2


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())