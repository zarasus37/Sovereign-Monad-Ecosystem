from fastapi.testclient import TestClient

from api.gnostic_api import app

client = TestClient(app)


def test_intake_forage_returns_resonance_metrics():
    payload = {
        "var_id": "pulse-123",
        "lane_a": 0.4,
        "lane_b": 0.2,
        "lane_c": 0.5,
        "v_mask": [True, False, True],
        "w_cong": True,
        "w_host_ratio": 0.3,
        "w_user_ratio": 0.7,
    }

    response = client.post("/intake/forage", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["var_id"] == "pulse-123"
    assert "coherence" in data
    assert "resonance" in data
    assert "resonance_index" in data
    assert "volumetric_coherence" in data
    assert "mueller_chain_energy" in data
    assert isinstance(data["coherence"], float)
    assert isinstance(data["volumetric_coherence"], float)


def test_mueller_resonance_endpoint():
    payload = {
        "s1": [1.0, 0.0, 0.0, 0.0],
        "s2": [0.8, 0.1, 0.0, 0.0],
    }

    response = client.post("/gnostic/mueller-resonance", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "mueller_resonance_score" in data
    assert 0.0 <= data["mueller_resonance_score"] <= 1.0
