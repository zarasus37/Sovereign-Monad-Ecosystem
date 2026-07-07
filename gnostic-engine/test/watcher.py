import requests
import time

# Layer 7.7: migrated to the typed /api/v1/gnosis/process endpoint.
URL = "http://127.0.0.1:8001/api/v1/gnosis/process"

print("--- SGE Automated Watcher Active ---")

while True:
    try:
        # Pinging V4 (Version) and V5 (Legal)
        payload = {
            "agent_id": "V5_LEGAL_MONITOR",
            "lane_a": 0.98, # Current Version License
            "lane_b": 0.98, # Historical Bedrock License
            "lane_c": 0.05, # Drift Intensity
            "v_mask": [True, True, True, True],
            "w_cong": True,
        }
        res = requests.post(URL, json=payload).json()

        status = res['verdict']
        sr = res['overall_score']

        print(f"[{time.strftime('%H:%M:%S')}] Variable: {res['agent_id']} | SR: {sr} | Verdict: {status}")

    except Exception as e:
        print(f"CRITICAL: Watcher cannot reach API. Is it down? ({e})")

    time.sleep(60) # Wait 1 minute
