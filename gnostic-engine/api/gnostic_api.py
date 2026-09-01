# api/gnostic_api.py

import os
import sys

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Make sure we can import from src/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))
from gnostic_engine.api import gnostic_router, gnostic_live_router

# The app is normally loaded as ``api.gnostic_api:app`` (uvicorn, tests), but
# tolerate ``api/`` itself being on sys.path.
try:
    from api.auth import guard
except ImportError:  # pragma: no cover - import-path fallback
    from auth import guard

SGE_VERSION = "2.0.0"

app = FastAPI(title="Gnostic Engine API", version=SGE_VERSION)

# CORS — allow the control-center frontend (any localhost port) and production origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every router-mounted route requires a valid X-API-Key. ``guard`` waves through
# the liveness and documentation paths listed in ``auth.PUBLIC_PATHS`` -- notably
# ``GET /api/v1/health``, which lives on the live router but must stay probeable.
app.include_router(gnostic_router, dependencies=[Depends(guard)])
app.include_router(gnostic_live_router, dependencies=[Depends(guard)])


@app.get("/")
async def root():
    return {"status": "ONLINE", "mode": "Volumetric-4D", "version": SGE_VERSION}