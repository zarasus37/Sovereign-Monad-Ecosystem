import requests, json

r = requests.post(
    'https://api.dune.com/api/v1/sql/execute',
    headers={'X-Dune-API-Key': 'n2Nszy1ReGgouxvZy1koOI0dpG1mPPpe', 'Content-Type': 'application/json'},
    json={'sql': 'SELECT 1 AS test'},
    timeout=10
)
print(r.status_code)
print(r.text[:500])
