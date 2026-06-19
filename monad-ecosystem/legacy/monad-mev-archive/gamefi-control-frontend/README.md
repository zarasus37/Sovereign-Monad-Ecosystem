# gamefi-control-frontend

Source-control frontend scaffold for the high-fidelity DeFi gaming rail.

## Modes

`gamefi-control-frontend` supports two honest data modes:

1. API mode
   - set `VITE_GAMEFI_API_URL`
   - reads `GET /gamefi/source-health`

2. Config mode
   - set `VITE_GAMEFI_SOURCE_CONFIG_URL` or use the default sample
   - reads a `gamefi-source.json` file shaped like `gamefi-control-core/config/gamefi-source.example.json`
   - derives lifecycle state client-side

If neither source is available, the UI reports that explicitly.

This package replaces the old `slot-frontend` naming and now represents the GameFi control UI directly.

## Usage

```powershell
cmd /c npm install
cmd /c npm run build
cmd /c npm run dev
```

Copy `.env.example` to `.env` if you want to point the UI at a real API or a different config file.
