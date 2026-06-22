import requests

BASE = "https://sovereign-rge-api.sovereign-mev.workers.dev"
PAYLOAD = {"spreadBps": 80, "vol": 0.00694, "portfolioUsd": 500000, "bridgeWindowSec": 900}
VALID_KEY = "YOUR_API_KEY_HERE"

tests = [
    ("no key (no header)",         {}),
    ("bad key",                    {"x-api-key": "sk-invalid-000000000000000"}),
    ("valid key (scout internal)", {"x-api-key": VALID_KEY}),
]

for label, headers in tests:
    try:
        r = requests.post(
            f"{BASE}/evaluate",
            headers={**headers, "Content-Type": "application/json"},
            json=PAYLOAD,
            timeout=10,
        )
        body = r.json()
        if r.status_code == 200:
            print(f"[{r.status_code}] {label}")
            print(f"       decision={body.get('decision')}  EV=${body.get('expectedValueUsd',0):.0f}  sharpe={body.get('sharpeLike',0):.2f}")
        else:
            print(f"[{r.status_code}] {label} -> {body}")
    except Exception as e:
        print(f"[ERR] {label} -> {e}")
