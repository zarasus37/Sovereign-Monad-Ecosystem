# gamefi-control-api

Source-health API for the high-fidelity DeFi gaming control surface.

## What this is

A minimal Express service that reads the local `gamefi-source.json` config and exposes the gaming-rail source lifecycle state over HTTP so `gamefi-control-frontend` can use live API mode.

This service is config-driven, not chain-driven.

It does not query the deployed `InboundReceiver` contract. It does not know what is registered on-chain. It reflects what the local config file says.

On-chain source registration is managed by:

```text
sovereign-monad/scripts/slot-source-handoff.js
```

After running that script against the live chain, update `gamefi-control-core/config/gamefi-source.json` or the path in `GAMEFI_SOURCE_CONFIG` to match.

## Endpoints

### GET /health

```json
{ "ok": true, "service": "gamefi-control-api" }
```

### GET /gamefi/source-health

Returns the current source lifecycle state derived from local config.

```json
{
  "eventId": "config-derived",
  "eventType": "GameFiSourceHealth",
  "timestampMs": 1710000000000,
  "state": "BOOTSTRAP_ONLY",
  "sources": {
    "bootstrap": {
      "address": "0x...",
      "label": "Bootstrap Revenue Source",
      "active": true,
      "note": "..."
    },
    "stake": {
      "address": null,
      "label": "Stake-Linked Revenue Source",
      "active": false,
      "note": "..."
    }
  },
  "configDriven": true,
  "note": "Source state derived from local config file. This is not an on-chain read."
}
```

Possible `state` values:

| State | Condition |
| --- | --- |
| `BOOTSTRAP_ONLY` | Bootstrap active plus valid address, stake not active |
| `CUTOVER_PENDING` | Bootstrap and stake both active plus valid addresses |
| `STAKE_ACTIVE` | Bootstrap not active, stake active plus valid address |
| `UNCONFIGURED` | Neither source is active with a valid address |

If the config file is missing or invalid, the service returns `503` with a JSON error body.

## Setup

```powershell
cd gamefi-control-api
cmd /c npm install
Copy-Item .env.example .env
```

Edit `.env` if your config lives somewhere other than the default path.

## Config

```env
PORT=4020
GAMEFI_SOURCE_CONFIG=../gamefi-control-core/config/gamefi-source.json
LOG_LEVEL=info
```

`GAMEFI_SOURCE_CONFIG` defaults to `../gamefi-control-core/config/gamefi-source.json` relative to the package root if not set.

## Run

```powershell
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```

## Connecting gamefi-control-frontend

Point `gamefi-control-frontend` at this service by setting:

```env
VITE_GAMEFI_API_URL=http://localhost:4020
```

The frontend calls `GET /gamefi/source-health` and renders the returned state.

## Phase-alignment note

- Keep this API aligned with the canonical Phase 1a state in `sovereign-monad`.
- This package does not prove on-chain status by itself.
- `stake.active` must remain `false` until the Stake-linked source actually exists on-chain.
