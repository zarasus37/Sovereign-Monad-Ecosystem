# externalization-readiness-core

Local activation-readiness surface for Data Rail externalization.

## What it does

- combines diversity status, rights review, integrity, boundary posture, and emergence observation
- produces an explicit blocked, conditional, or ready posture
- exposes the exact checklist items that still prevent activation
- keeps commercial certification downstream: readiness does not issue `LightVerified`, it only determines whether externalization can even be considered

This package does not activate externalization. It only makes the activation gate explicit.

## Run

```powershell
cd externalization-readiness-core
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```
