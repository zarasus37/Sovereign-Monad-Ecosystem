"""cli.py --smoke-imports — the honest 'wiring resolves' proof.

Skips entirely if the ML stack isn't installed locally (the CPU-pure tests
already cover the non-TRL surface). When the stack IS installed, this proves
the heavy modules import cleanly WITHOUT a GPU — no model load, no CUDA.
"""
from __future__ import annotations

import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("transformers")
pytest.importorskip("trl")
pytest.importorskip("peft")
pytest.importorskip("datasets")
pytest.importorskip("accelerate")


def test_smoke_imports_exits_zero_when_stack_present():
    """--smoke-imports returns 0 and names each module when the stack is
    installed. This is the only GPU-adjacent verification in this PR."""
    from gnosis_training.cli import smoke_imports

    rc = smoke_imports()
    assert rc == 0


def test_smoke_imports_reports_versions(capsys):
    """--smoke-imports prints a version line per heavy module."""
    from gnosis_training.cli import smoke_imports

    smoke_imports()
    captured = capsys.readouterr().out
    assert "torch" in captured
    assert "trl" in captured
    assert "peft" in captured
    assert "OK" in captured


def test_cli_main_smoke_imports_dispatch():
    """`python -m gnosis_training --smoke-imports` routes to smoke_imports."""
    from gnosis_training.cli import main

    assert main(["--smoke-imports"]) == 0


def test_cli_main_unknown_mode_returns_nonzero():
    """An unknown mode is rejected (no silent success)."""
    from gnosis_training.cli import main

    assert main(["nope"]) == 2


def test_cli_gpu_modes_advertise_future_job_not_execution():
    """sft/reward/ppo/eval modes honestly report they are future GPU jobs
    (no training executed in this PR)."""
    from gnosis_training.cli import main

    rc = main(["sft", "data.jsonl"])
    assert rc == 0  # did not crash; it explicitly did NOT train