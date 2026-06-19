# execution-truth-core

Local readiness surface for runtime execution-truth closure.

This package does not claim live truth by itself. It evaluates whether the repo has:

- live Phase 1a proof recorded
- bootstrap approved-source registration recorded
- runtime/provider hardening implemented
- guarded-live documentation in place
- an observed guarded-live execution record

## Current intent

Use this as the explicit gate between:

- contract/routing deployment proof
- runtime execution-truth closure
- funded `Cardia` activation
- production/public activation

## Commands

```powershell
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```
