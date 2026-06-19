# Base-Arbitrum Deployment Guide

This file is a deployment companion for the Base/Arbitrum artifacts in this repo. It is not the canonical statement of project phase or live readiness.

Use these in order:

1. `https://github.com/zarasus37/sovereign-monad`
2. `docs/MIGRATION-BASE-ARB.md`
3. `ARCHITECTURE.md`
4. `docs/GUARDED-LIVE-ACTIVATION.md`

## Recommended Deployment Mode

- Base mainnet
- Arbitrum mainnet
- `DRY_RUN=true`
- production-like validation gates

If you are exercising the Base/Arbitrum artifact path, use `docker-compose.mainnet.yml` as the deployment entrypoint.

## Mainnet DRY_RUN Deployment

```bash
cd monad-mev
copy .env.example .env
docker compose -f docker-compose.mainnet.yml up -d --build
start http://localhost:8501
```

Fill `.env` with the current Base and Arbitrum RPC endpoints, wallet key, and market addresses before startup.

## Current Validation Profile

```env
DRY_RUN=true
MIN_SPREAD_BPS=12
MIN_LIQUIDITY_10BPS_USD=750
MIN_CAPACITY_USD=3000
MIN_SIZE_USD=250
RISK_FIXED_COST_BPS=8
RISK_MIN_EFFECTIVE_SPREAD_BPS=12
MAX_SINGLE_TRADE_PERCENT=10
MAX_BRIDGE_EXPOSURE_PERCENT=25
MAX_SLIPPAGE_BPS=50
```

This is still a `DRY_RUN` validation profile, not a live-capital approval profile.

## Guarded-Live Path

When wallet funding and operator readiness are complete, the funded session path is:

```powershell
docker compose -f docker-compose.mainnet.yml -f docker-compose.guarded-live.override.yml config
docker compose -f docker-compose.mainnet.yml -f docker-compose.guarded-live.override.yml up -d spread-scanner opportunity-constructor risk-engine portfolio-manager arb-bot alert-rules
```

Use `docs/GUARDED-LIVE-ACTIVATION.md` as the checklist and rollback guide for that step.

## Verify Operations

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String 'base-arb-mev-mainnet'
docker exec base-arb-mev-mainnet-kafka kafka-topics --list --bootstrap-server localhost:29092
docker exec base-arb-mev-mainnet-kafka sh -lc "kafka-console-consumer --bootstrap-server localhost:9092 --topic market.base.price-snapshot --timeout-ms 8000 --max-messages 4"
docker exec base-arb-mev-mainnet-kafka sh -lc "kafka-console-consumer --bootstrap-server localhost:9092 --topic market.arbitrum.price-snapshot --timeout-ms 8000 --max-messages 4"
docker exec base-arb-mev-mainnet-kafka sh -lc "kafka-console-consumer --bootstrap-server localhost:9092 --topic market.spread.signal --timeout-ms 8000 --max-messages 5"
```

Downstream flow may stay sparse under production-like `DRY_RUN` thresholds. That can be expected when executable depth is thin.

## Licensed Self-Hosted Delivery

For Fund and Enterprise buyers using the full licensed stack, use:

- `docker-compose.mainnet.yml`
- `docker-compose.licensed.yml`
- `scripts/activate-license.sh`
- `scripts/validate-license.sh`
- `scripts/deploy-licensed.sh`

The activation and packaging flow is documented in `docs/LICENSED-DEPLOYMENT.md`.

## Commercial API Deployment

For the public-facing commercial services in `templates/commercial-stack`, the deployment modes are:

- local validation: `docker-compose.yml` + `docker-compose.local.yml`
- localhost-only production host: `docker-compose.yml` + `docker-compose.prod.yml`
- internet-facing edge with TLS: `docker-compose.yml` + `docker-compose.edge.yml`

The edge deployment expects:

- `api.<root-domain>`
- `billing.<root-domain>`
- `licenses.<root-domain>`

All three should resolve to the same host. Caddy terminates TLS and routes each subdomain to the corresponding internal service.

## Legacy Modes

`docker-compose.yml`, `docker-compose.testnet.yml`, and `docker-compose.prod.yml` remain in the repo as reference stacks and should not be treated as canonical current deployment status.
