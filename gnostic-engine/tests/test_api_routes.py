from fastapi.testclient import TestClient

from api.gnostic_api import app

client = TestClient(app)


def test_deprecated_intake_forage_is_gone():
    """The legacy VolumetricScanner path was retired at its published Sunset
    date (Sun, 01 Sep 2026). It carried no Lane C kill-switch; callers use
    POST /api/v1/gnosis/process. This test exists so it cannot quietly return.
    """
    payload = {"var_id": "pulse-123", "lane_a": 0.4, "lane_b": 0.2, "lane_c": 0.5}
    assert client.post("/intake/forage", json=payload).status_code == 404


def test_gnosis_summary_is_gone():
    """Removed with /intake/forage, which was its only data source. It had no
    in-tree consumer; per-agent history now lives on the typed engine path.
    """
    assert client.get("/status/gnosis-summary").status_code == 404


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
