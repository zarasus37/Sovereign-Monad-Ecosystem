# Trading API Template

This package exposes the risk engine as a lightweight commercial API for Starter and Pro buyers.

## Endpoints

- `POST /evaluate`
- `GET /health`
- `GET /config`

For public deployment behind the commercial edge stack, this service should sit behind:

- `https://api.<root-domain>`

## Auth and enforcement

- API key in `X-API-Key`
- daily rate limits by tier
- AUM-cap enforcement by tier
- read-only config endpoint so buyers can verify thresholds
- `p01Pnl` is the canonical 1st-percentile tail-PnL field in evaluation responses
- `maxDrawdownEstimate` remains as a compatibility alias for earlier clients

## Local run

```bash
copy .env.example .env
npm install
npm run dev
```

## Container run

```bash
docker build -t smev-api .
docker run --rm -p 3000:3000 --env-file .env smev-api
```

## Example checks

```bash
curl http://127.0.0.1:3000/health
curl -H "x-api-key: starter-demo-key" http://127.0.0.1:3000/config
curl -X POST http://127.0.0.1:3000/evaluate \
  -H "Content-Type: application/json" \
  -H "x-api-key: starter-demo-key" \
  -d "{\"direction\":\"buy_M_sell_E\",\"spreadBps\":35,\"bridgeDelaySec\":4,\"sizeSuggestionUsd\":500,\"clientAumUsd\":1000000,\"mode\":\"bridge_based\"}"
```

For the cleanest local path, prefer the combined stack in `templates/commercial-stack/`.
Use `docker-compose.yml` plus `docker-compose.local.yml` for local checks, or `docker-compose.prod.yml` for localhost-only production binding.
