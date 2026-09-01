import os
from pathlib import Path
import sys

# The HTTP surface fails closed when no API key is configured. Mark the suite as
# test mode so the pre-existing route tests keep exercising handlers rather than
# the 503. test_auth.py overrides this per-test to cover the real modes.
os.environ.setdefault("GNOSTIC_ENV", "test")

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

for path in (ROOT, SRC):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)
