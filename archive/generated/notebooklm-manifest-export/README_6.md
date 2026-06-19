# data-rail-router

Local Data Rail routing logic for Sovereign Monad.

## What it does

- reads normalized behavioral events from `data-rail-core`
- routes safe events into internal destinations
- blocks external product routes until diversity thresholds are met and rights gates are satisfied

This package is local-analysis-only. It does not emit live revenue routes and it does not externalize behavioral data.

## Run

```powershell
cd data-rail-router
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```
