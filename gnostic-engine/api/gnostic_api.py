# api/gnostic_api.py

import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Make sure we can import from src/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))
from gnostic_engine.api import gnostic_router, gnostic_live_router

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

app.include_router(gnostic_router)
app.include_router(gnostic_live_router)


@app.get("/")
async def root():
    return {"status": "ONLINE", "mode": "Volumetric-4D", "version": SGE_VERSION}