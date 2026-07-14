"""Tracking — W&B / MLflow integration (spec line 285-287), WIRED BUT DEFERRED.

The spec names Weights & Biases (TRACKING) and MLflow (REGISTRY). They are
opt-in extras (``uv sync --extra tracking``) so the CPU import-smoke and local
pytest run do NOT pull them. This module exposes ``get_tracker(name)`` which
lazy-imports the backend inside the function and raises a documented
deferred-integration error until the extra is installed AND the run is on a GPU
box. This is an honest stub, not fake wiring: the call site is real, the
backend is real, the only thing deferred is the install + the actual run.
"""
from __future__ import annotations

from typing import Any, Literal

TrackerName = Literal["wandb", "mlflow"]


def get_tracker(name: TrackerName) -> Any:
    """Return the named tracking backend (wandb / mlflow). Lazy-imports the
    backend inside the function; raises a documented error if the extra is not
    installed. The trainers call this with ``report_to`` set to the resolved
    backend name once enabled; by default ``SFTConfig``/etc. set
    ``report_to="none"`` so no tracker is contacted in the import-smoke."""
    if name == "wandb":
        try:
            import wandb 
        except ImportError as exc:
            raise RuntimeError(
                "wandb integration is wired but deferred; run `uv sync --extra tracking` "
                "and set GNOSIS_TRACKING=wandb to enable."
            ) from exc
        return wandb
    if name == "mlflow":
        try:
            import mlflow 
        except ImportError as exc:
            raise RuntimeError(
                "mlflow integration is wired but deferred; run `uv sync --extra tracking` "
                "and set GNOSIS_TRACKING=mlflow to enable."
            ) from exc
        return mlflow
    raise ValueError(f"unknown tracker {name!r}; expected 'wandb' or 'mlflow'")


def enabled_tracker() -> TrackerName | None:
    """Read the ``GNOSIS_TRACKING`` env var to decide which backend (if any) the
    trainers should report to. Returns ``None`` when unset (the default, so the
    import-smoke contacts no external service). CPU-pure."""
    import os

    value = os.environ.get("GNOSIS_TRACKING", "").strip().lower()
    if value in ("wandb", "mlflow"):
        return value  # type: ignore[return-value]
    return None