import pytest
from score_utils import compute_v4_score, assign_tier

def test_latent_space_genesis():
    # Inputs: (0.95, 0.94, 0.95, PPS=1.0)
    v4 = compute_v4_score(0.95, 0.94, 0.95, pps=1.0)
    assert round(v4, 4) == 0.9520
    assert assign_tier(v4) == "SOVEREIGN"
