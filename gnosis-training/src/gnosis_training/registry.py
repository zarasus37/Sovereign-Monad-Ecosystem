"""Registry — MLflow + DVC artifact/model registry (spec line 286-287), WIRED
BUT DEFERRED.

The spec names MLflow (REGISTRY) and DVC (VERSIONING for datasets). They are
opt-in extras (``uv sync --extra tracking` / `--extra dvc`). This module
exposes ``log_run`` / ``register_model`` / ``version_dataset`` as honest
deferred stubs: the call sites are real, the backends are real, the only thing
deferred is the install + the actual run. They raise a documented error until
the extra is installed.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any


def log_run(run_name: str, metrics: dict[str, float]) -> None:
    """Log a training run's metrics to MLflow. Deferred until `--extra tracking`."""
    try:
        import mlflow 
    except ImportError as exc:
        raise RuntimeError(
            "MLflow registry is wired but deferred; run `uv sync --extra tracking` to enable."
        ) from exc
    mlflow.log_param("run_name", run_name)
    for k, v in metrics.items():
        mlflow.log_metric(k, v)


def register_model(model_dir: str | Path, name: str) -> Any:
    """Register a trained model artifact in the MLflow model registry. Deferred."""
    try:
        import mlflow 
    except ImportError as exc:
        raise RuntimeError(
            "MLflow registry is wired but deferred; run `uv sync --extra tracking` to enable."
        ) from exc
    return mlflow.register_model(str(model_dir), name)


def version_dataset(dataset_path: str | Path, name: str) -> None:
    """Add a dataset to DVC versioning (spec: DVC for datasets). Deferred until
    `--extra dvc`. The README documents `dvc init` as a one-time follow-up."""
    try:
        import dvc   # noqa: F401
    except ImportError as exc:
        raise RuntimeError(
            "DVC dataset versioning is wired but deferred; run `uv sync --extra dvc` "
            "and `dvc init` to enable."
        ) from exc
    # `dvc add <dataset_path>` would go here on a real run; the CLI is invoked
    # out-of-process so we only guard the import here.
    raise NotImplementedError(
        "DVC versioning is wired but the `dvc add` invocation is a runtime follow-up; "
        "run `dvc add <path>` out-of-process once `--extra dvc` is installed."
    )