# Gnostic Engine

**Volumetric 4D Gnostic Processing Engine** for the Sovereign Monad Ecosystem.

## Features

- Volumetric 4D coherence analysis (Stokes-Mueller + Pulfrich)
- Market truth foraging with structural resonance scoring
- SynapticWatcher for temporal state tracking
- Designed for integration with the Monad Ecosystem agent layer

## Installation (Development)

```bash
cd gnostic-engine
uv venv .venv
. .venv/Scripts/activate
uv pip install -e .
```

## Usage

```python
from gnostic_engine import SynapticWatcher, forage_market_truth

# Temporal tracking
watcher = SynapticWatcher()
watcher.track("MARKET_VOLATILITY_BTC", 0.87)

# Market foraging
forage_market_truth()
```

## API

Run the local API from the `gnostic-engine` folder:

```bash
uvicorn api.gnostic_api:app --reload --port 8000
```

Available endpoints:

- `POST /intake/forage` — ingest packet data and return volumetric resonance metrics
- `GET /status/gnosis-summary` — summary of recent verdicts
- `GET /` — health and version
- `POST /gnostic/scan` — package-native volumetric scan
- `POST /gnostic/resonance` — structural resonance score for two Stokes vectors
- `POST /gnostic/coherence` — volumetric coherence across multiple Stokes vectors
- `POST /gnostic/mueller-resonance` — Mueller chain resonance score for a Stokes vector

Example request payloads:

- `POST /intake/forage`

```json
{
  "var_id": "pulse-123",
  "lane_a": 0.4,
  "lane_b": 0.2,
  "lane_c": 0.5,
  "v_mask": [true, false, true],
  "w_cong": true,
  "w_host_ratio": 0.3,
  "w_user_ratio": 0.7
}
```

- `POST /gnostic/mueller-resonance`

```json
{
  "s1": [1.0, 0.0, 0.0, 0.0],
  "s2": [0.8, 0.1, 0.0, 0.0]
}
```

## Project Structure

```
src/gnostic_engine/
├── core/
│   └── gnostic_engine.py      # SynapticWatcher, core math
├── foraging/
│   └── market_forager.py      # Public market data intake
└── __init__.py
```

## Status

Early Phase 3 — Package structure established. Further modules (api/, core/ engines) to be added.

---

*Part of the Sovereign Monad Ecosystem (The_Sovereign monorepo)*