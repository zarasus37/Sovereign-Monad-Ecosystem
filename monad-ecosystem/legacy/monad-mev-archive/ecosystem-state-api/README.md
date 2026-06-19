# ecosystem-state-api

Shared internal state/API surface for the local zero-capital Sovereign Monad analysis stack.

## What this is

This service composes the current local analysis packages into one snapshot:

- `organ-runtime`
- `signal-layer`
- `oracle-core`
- `gnosis-core`
- `boundary-stress-monitor`
- downstream Data Rail, activation, data-product, emergent-protocol, and `lightverify-core` local surfaces

It is local-analysis-only. It does not read chain state and it does not make deployment claims.

## Endpoints

### `GET /health`

```json
{ "ok": true, "service": "ecosystem-state-api" }
```

### `GET /ecosystem/state`

Returns the full shared local state snapshot.

### `GET /ecosystem/state/summary`

Returns only the summary section of the shared local state snapshot.

## Config

```env
PORT=4040
ORGAN_RUNTIME_CONFIG=../organ-runtime/config/runtime.json
LOG_LEVEL=info
```

`ORGAN_RUNTIME_CONFIG` defaults to the checked-in organ runtime analysis config.

## Run

```powershell
cd ecosystem-state-api
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```

## Notes

- This package expects sibling package build artifacts to exist.
- Run the workspace verification script before starting it if needed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-active-packages.ps1
```

- Current scope is a local integration surface only. It does not replace live governance, Dove, or on-chain verification.
