"""sys.path seam to the canonical Python LOGOC manifold mirror (Layer 7).

The Gnostic Engine lives in ``gnostic-engine/src/gnostic_engine/``; the
canonical Python manifold mirror lives in
``monad-ecosystem/packages/logoc/peirce/``. There is no shared install — the
manifold is imported by registering a synthetic package whose search path is
the peirce directory, so ``manifold.py``'s ``from ._numerics import ...``
relative import resolves without executing the real ``peirce/__init__.py``
(which eagerly imports the numpy ML classifier / pipeline and would couple
this lightweight seam to heavy optional deps).

Path resolution (from this file):
    gnostic-engine/src/gnostic_engine/classification/_manifold_proxy.py
    → 4 parents up = repo root (The_Sovereign)
    → monad-ecosystem/packages/logoc/peirce

This fails loud at import (``ImportError`` / ``ModuleNotFoundError``) if the
repo layout changes; guarded by ``tests/test_classifier.py`` asserting
``get_manifold().all_classes()`` length is 66.
"""
from __future__ import annotations

import importlib
import sys
import types
from pathlib import Path

# Synthetic package name used to host the imported manifold submodule. The
# name is deliberately unique so it cannot collide with a real top-level
# package on sys.path.
_PROXY_PKG = "logoc_peirce_proxy"


def _peirce_dir() -> Path:
    here = Path(__file__).resolve().parent  # .../classification/
    repo_root = here.parent.parent.parent.parent  # The_Sovereign/
    return repo_root / "monad-ecosystem" / "packages" / "logoc" / "peirce"


def _ensure_proxy_package() -> types.ModuleType:
    """Register the synthetic namespace package and return it."""
    if _PROXY_PKG not in sys.modules:
        pkg = types.ModuleType(_PROXY_PKG)
        pkg.__path__ = [str(_peirce_dir())]
        pkg.__package__ = _PROXY_PKG
        sys.modules[_PROXY_PKG] = pkg
    return sys.modules[_PROXY_PKG]


_ensure_proxy_package()

# Importing the manifold submodule resolves ``from ._numerics import ...``
# against the synthetic package's __path__ (the peirce dir), bypassing the
# real __init__.py and its heavy ML imports.
_manifold_mod = importlib.import_module(f"{_PROXY_PKG}.manifold")
PeirceManifold = _manifold_mod.PeirceManifold
PeirceSignClass = _manifold_mod.PeirceSignClass
get_manifold = _manifold_mod.get_manifold

__all__ = ["PeirceManifold", "PeirceSignClass", "get_manifold"]