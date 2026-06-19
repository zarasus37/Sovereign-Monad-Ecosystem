# Gnostic Engine

## Purpose

Gnostic Engine is the volumetric 4D processing pillar of the Sovereign Monad ecosystem. It provides the Python runtime for structural scanning, resonance analysis, and related API surfaces.

## Contents

- `src/` - engine source code
- `api/` - FastAPI routes and service entry points
- `dashboard/` - UI and operator-facing surfaces
- `tests/` - Python test coverage
- `setup/` - bootstrap and environment helpers
- `notes/` - working notes and supporting material

## Run

Use the Python toolchain from this folder:

```bash
uv sync
uv run pytest tests -v
uv run ruff check src/
uv run uvicorn api.gnostic_api:app --reload --port 8000
```

If you are running workspace-wide checks from the repository root, use:

```powershell
pnpm test
pnpm lint
pnpm build
```

## Do Not Put Here

- Monad Ecosystem agent packages
- TTC philosophical source material
- archive exports or notebooks
- root-level workspace contracts
- temporary virtual environment junk outside `.venv/`

