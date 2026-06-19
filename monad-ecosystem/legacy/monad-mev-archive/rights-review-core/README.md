# rights-review-core

Local rights review workflow for the Data Rail.

## What it does

- reviews externalization decisions against the current rights policy
- classifies cases into deny, conditional, redact, or manual review
- keeps a bounded internal review queue while externalization remains blocked

This package does not approve externalization. It only structures the review workflow.

## Run

```powershell
cd rights-review-core
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```
