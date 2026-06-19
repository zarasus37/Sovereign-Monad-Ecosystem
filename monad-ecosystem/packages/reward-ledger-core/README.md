# reward-ledger-core

Internal reward ledger surface for the local Data Rail.

## What it does

- reads reward-eligible Data Rail events
- converts them into internal non-monetary ledger entries
- tracks actor balances in internal credits only

This package does not create payouts and does not claim live economic distribution. It is an internal accounting surface only.
External productization remains blocked until diversity thresholds are met and rights gates are satisfied.

## Run

```powershell
cd reward-ledger-core
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```
