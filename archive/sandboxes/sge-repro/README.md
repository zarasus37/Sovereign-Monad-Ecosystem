SGE Repro Stub

This minimal example demonstrates the SGE intake API and worker pattern used in the deep dive.

Services
- API: `POST /intake/forage` (port 8000)
- Worker: background consumer that pops tasks from Redis and computes a Structural Read
- Redis: queue + result store

Quick run (local, without Docker)

1. Create virtualenv and install:

```bash
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
```

2. Run Redis (or use the Docker compose below)
3. Start API:

```bash
uvicorn src.intake.api.app:app --reload --port 8000
```

4. Start worker in another terminal:

```bash
python -u src/intake/worker/main.py
```

Docker Compose

```bash
docker compose up --build
```

Notes
- This is a small reproducible stub for local experimentation. The structural computation is intentionally simplified and intended as a placeholder for the full SGE logic.
