# lightverify-core

Local commercial certification artifact for integrity-verified licensed data.

## What it does

- defines a bounded `LightVerify` assessment artifact for candidate data products
- keeps public certification binary:
  - `LightVerified`
  - not `LightVerified`
- keeps internal judgment richer than the public mark through a private scorecard:
  - provenance
  - coherence
  - de-identification
  - rights readiness
- supports separate lower commercial classes without weakening the public seal:
  - `lightverified`
  - `observed`
  - `restricted`
  - `rejected`
- keeps certification, revocation, and public disclosure as explicit records
- exposes a local snapshot surface for shared-state visibility

## Boundaries

- this is a commercial certification artifact, not a runtime execution token
- it does not sit in Kafka trade routing
- it does not ask Gnosis to sign live arbitrage moves
- it does not create a public authenticity rating ladder
- it does not authorize Router, Oracle, Dove, or execution surfaces

## Public model

`LightVerify` should mean one thing only:

- this bundle cleared a defined integrity and provenance bar

Anything below that bar should be sold, if at all, under a separate class rather than as a weaker `LightVerify` grade.

## Run

```powershell
cd lightverify-core
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```
