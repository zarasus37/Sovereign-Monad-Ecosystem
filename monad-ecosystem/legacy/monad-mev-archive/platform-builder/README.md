# platform-builder

Local builder infrastructure for the zero-capital Sovereign Monad platform layer.

## What it does

- reads the local shared ecosystem state
- derives available build capabilities
- evaluates expansion recipes against the current local stack
- outputs a builder plan showing what is ready, blocked, and next

This package is local-analysis-only. It does not provision cloud resources and it does not claim live onchain readiness.

## Run

```powershell
cd platform-builder
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```
