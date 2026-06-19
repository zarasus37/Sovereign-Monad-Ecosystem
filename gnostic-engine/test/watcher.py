import requests
import time

# FIXED: Now using the full loopback and port
URL = "http://127.0.0.1:8000/intake/forage"

print("--- SGE Automated Watcher Active ---")

while True:
    try:
        # Pinging V4 (Version) and V5 (Legal)
        payload = {
            "var_id": "V5_LEGAL_MONITOR", 
            "lane_a": 0.98, # Current Version License
            "lane_b": 0.98, # Historical Bedrock License
            "lane_c": 0.05  # Drift Intensity
        }
        res = requests.post(URL, json=payload).json()
        
        status = res['verdict']
        sr = res['structural_read']
        
        print(f"[{time.strftime('%H:%M:%S')}] Variable: {res['var']} | SR: {sr} | Verdict: {status}")
        
    except Exception as e:
        print(f"CRITICAL: Watcher cannot reach API. Is it down? ({e})")
        
    time.sleep(60) # Wait 1 minute
