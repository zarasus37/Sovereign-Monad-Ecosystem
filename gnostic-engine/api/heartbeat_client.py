import requests
import time

URL = "http://127.0.0.1:8000/intake/forage"

while True:
    try:
        payload = {
            "var_id": "V4_MONITOR",
            "lane_a": 0.95,
            "lane_b": 0.92,
            "lane_c": 0.10
        }
        res = requests.post(URL, json=payload).json()
        print(f"[{time.strftime('%H:%M:%S')}] Verdict: {res['verdict']} | SR: {res['structural_read']}")
    except Exception as e:
        print(f"[{time.strftime('%H:%M:%S')}] Heartbeat error: {e}")
    time.sleep(60)