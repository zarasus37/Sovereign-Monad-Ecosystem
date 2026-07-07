# Layer 7.7: migrated off the deprecated /intake/forage path onto the typed
# /api/v1/gnosis/process endpoint. Reads the typed response's `overall_score`
# (legacy forage returned `structural_read`); uses agent_id (legacy used var_id).
import requests
import time

URL = "http://127.0.0.1:8001/api/v1/gnosis/process"

while True:
    try:
        payload = {
            "agent_id": "V4_MONITOR",
            "lane_a": 0.95,
            "lane_b": 0.92,
            "lane_c": 0.10,
            "v_mask": [True, True, True, True],
            "w_cong": True,
        }
        res = requests.post(URL, json=payload).json()
        print(
            f"[{time.strftime('%H:%M:%S')}] Verdict: {res['verdict']} | "
            f"SR: {res['overall_score']}"
        )
    except Exception as e:
        print(f"[{time.strftime('%H:%M:%S')}] Heartbeat error: {e}")
    time.sleep(60)