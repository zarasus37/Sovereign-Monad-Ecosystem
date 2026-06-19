# gamefi-control-core

Approved-source lifecycle monitor for the high-fidelity DeFi gaming rail.

## Purpose

`gamefi-control-core` is transitional control scaffolding for the GameFi rail. It publishes the current approved-source lifecycle state so operators and downstream services can tell whether the system is still using:

- bootstrap source only
- both bootstrap and Stake-linked sources during cutover
- Stake-linked source as the active path

It does not mutate contracts. On-chain source registration is still handled in `sovereign-monad` by the legacy-named `scripts/slot-source-handoff.js`.

## Current model

- bootstrap source is the truthful Phase 1a starting point
- Stake-linked source stays inactive until it actually exists on-chain
- local JSON config is the source of truth for this service
- health snapshots are emitted to Kafka

## Files

- `.env.example`: service environment template
- `config/gamefi-source.example.json`: source lifecycle template
- `src/source-state.ts`: lifecycle derivation and validation
- `src/monitor.ts`: Kafka emitter service

## Usage

1. Copy `.env.example` to `.env`
2. Copy `config/gamefi-source.example.json` to `config/gamefi-source.json`
3. Fill real values
4. Install and build

```powershell
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```

## Emitted state

- `BOOTSTRAP_ONLY`
- `CUTOVER_PENDING`
- `STAKE_ACTIVE`
- `UNCONFIGURED`

## Constraint

This package is intentionally config-driven. It does not claim live on-chain truth on its own.
It replaces the old `slot-core` naming and should be read as GameFi control scaffolding, not a slot-machine product surface.
