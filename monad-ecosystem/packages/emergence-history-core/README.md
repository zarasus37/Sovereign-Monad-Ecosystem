# emergence-history-core

Isolated historical-record store for ratified emergence claims.

## What it does

- registers ratified candidate claims into a bounded history store
- enforces sequence integrity for `ratification -> optional evaluation -> optional retraction`
- assembles stable historical records from claim-core artifacts
- rejects duplicate registration and duplicate evaluation/retraction writes
- rejects evaluation and retraction for unknown claims
- preserves retraction as a historical correction, not a live-state mutation
- keeps the history layer local-analysis-only
- does not connect to Router, Oracle, Data Rail, Dove, or Gnosis

This package assumes claim shape validation happens in `emergence-claim-core`.
Its job is narrower: preserve a trustworthy ratification and retraction order once a claim reaches the historical record.

## Package surface

- history-store creation
- ratified record registration
- prediction-evaluation registration
- bounded retraction registration
- read-only history entry lookup
- sequence-integrity note creation

## Boundaries

- historical record first, operating-surface integration never by default
- Narrative is the only intended initial read path
- retraction updates the record; it does not authorize retroactive changes to live packages

## Run

```powershell
cd emergence-history-core
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```
