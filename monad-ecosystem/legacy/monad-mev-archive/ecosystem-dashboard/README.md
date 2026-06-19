# ecosystem-dashboard

Internal dashboard/operator view for the local zero-capital Sovereign Monad state stack.

## What it does

- reads `ecosystem-state-api`
- renders the current summary posture
- shows organ readiness, Oracle/Gnosis/Boundary outputs, and active frontier state

This is a local internal surface only. It does not claim live chain truth.

## Config

```env
VITE_ECOSYSTEM_STATE_API_URL=http://localhost:4040
```

## Run

```powershell
cd ecosystem-dashboard
cmd /c npm install
cmd /c npm run build
cmd /c npm run dev
```
