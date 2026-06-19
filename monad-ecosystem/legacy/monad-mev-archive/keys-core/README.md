# keys-core

Local Keys layer scaffold for Sovereign Monad.

## What it does

- defines local key activation classes
- applies delegation boundary rules
- blocks NFT-dependent activation because agent NFTs are not implemented
- keeps key logic local and policy-driven until live key infrastructure exists

This package is a local scaffold only. It does not mint NFTs and it does not write on-chain identity state.

## Run

```powershell
cd keys-core
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```
