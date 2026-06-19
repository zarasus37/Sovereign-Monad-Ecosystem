# data-rail-core

Local Data Rail preparation scaffold for Sovereign Monad.

## What it does

- defines a behavioral capture policy surface
- normalizes behavioral events into a reward/data schema
- produces a local reward eligibility preview
- keeps the Data Rail explicitly internal-only until diversity thresholds are met and rights gates are satisfied

This package does not monetize data and does not route live revenue. It prepares Layer 14 so capture rules and schema do not get invented retroactively.

## Run

```powershell
cd data-rail-core
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```
