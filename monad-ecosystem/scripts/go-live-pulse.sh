#!/usr/bin/env bash
# Pulse check after go-live boot (docs/GO_LIVE_EXECUTION.md)
set -euo pipefail
HOST="${SOVEREIGN_HOST_URL:-http://localhost:3001}"

echo "== Pulse: $HOST/health =="
curl -sf "$HOST/health" | tee /tmp/sovereign-health.json
echo
echo
echo "== Metrics scrape (first lines) =="
curl -sf "$HOST/metrics" | head -n 40 || true
echo
echo
node -e '
const fs = require("fs");
const j = JSON.parse(fs.readFileSync("/tmp/sovereign-health.json", "utf8"));
const ok = j.status === "ALIVE";
console.log(ok ? "PULSE_OK" : "PULSE_FAIL");
console.log(JSON.stringify({
  status: j.status,
  kafka: j.kafka,
  redis: j.redis,
  live_funding: j.live_funding,
  key_custody: j.key_custody,
  bootstrap_env_fallback: j.bootstrap_env_fallback,
}, null, 2));
process.exit(ok ? 0 : 1);
'
