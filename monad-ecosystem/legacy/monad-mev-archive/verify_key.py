import requests

key = "sk-sovereign-36b7cb69c79c401e1c674c084c5af286"
r = requests.post(
    "https://sovereign-rge-api.sovereign-mev.workers.dev/evaluate",
    headers={"x-api-key": key, "Content-Type": "application/json"},
    json={"spreadBps": 80, "vol": 0.00694, "portfolioUsd": 500000, "bridgeWindowSec": 900},
    timeout=10,
)
print(f"HTTP {r.status_code}")
print(f"Decision:  {r.json().get('decision')}")
print(f"Remaining: {r.json().get('callsRemainingToday')} / 1000 today")
