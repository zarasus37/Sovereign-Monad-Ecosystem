# data-rail-governance

Local Data Rail governance surface for diversity thresholds, rights policy, and externalization gates.

## What it does

- defines the population diversity thresholds required before any behavioral data can be externalized
- defines rights policy for which actor classes, surfaces, outcomes, and tags can ever be externalized
- evaluates the current local behavioral sample against those gates
- keeps external productization blocked until the thresholds are both defined and met

This package does not externalize data. It only makes the gate explicit and testable.

## Run

```powershell
cd data-rail-governance
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```
