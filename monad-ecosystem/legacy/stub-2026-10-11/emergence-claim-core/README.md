# emergence-claim-core

Local emergence claim artifacts for bounded emergence recognition design.

## What it does

- defines a bounded emergence claim object with three local evaluation states:
  - `evidence_insufficient`
  - `candidate`
  - `not_candidate`
- keeps ratification out of the claim state model
- keeps prediction evaluation in its own record
- keeps retraction in its own record
- enforces metric/narrative source independence at claim creation
- records explicit metric and narrative generation paths
- supports both emergence tiers:
  - `causal_set`
  - `full_field`
- requires at least two causal streams plus one per-stream necessity argument for each `causal_set` claim
- requires an active subsystem set for each `full_field` claim
- permits only `historical_record` and `narrative_read_path` notification surfaces
- does not connect to Router, Oracle, Data Rail, Dove, or Gnosis

This package is local-analysis-only. It does not declare emergence by itself and it does not authorize any operating-surface behavior.

The live agent loop added in this package preserves that boundary: it creates one profile-routed behavioral data point and can record that data point on-chain, but it does not ratify emergence or grant operating authority.

## Package surface

- claim creation and promotion helpers
- separate ratification, prediction-evaluation, and retraction record builders
- historical-record assembly from already-created claim artifacts
- typed public exports for:
  - shared and tier-specific create inputs
  - claim shapes
  - stream and subsystem snapshot refs
  - evidence refs
  - falsifiable prediction shapes
  - evaluation and retraction record types
- live agent proof helpers for:
  - Big Five profile encoding
  - full Agent 0 IPIP-NEO + SD3 profile encoding
  - deterministic psychometric routing
  - Dove monitoring flag derivation
  - record-only behavioral decisions
  - on-chain Agent profile registration
  - on-chain `EmergenceRecorder` submission

## Run

```powershell
cd emergence-claim-core
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```

Run the live behavioral loop after `EmergenceRecorder.sol` is deployed:

```powershell
cd emergence-claim-core
cmd /c npm run build
$env:EMERGENCE_RECORDER_ADDRESS="0x..."
cmd /c npm run live:agent
```

Prepare Agent 0 registration payload without sending a transaction:

```powershell
cd emergence-claim-core
cmd /c npm run build
$env:AGENT_0_PREPARE_ONLY="true"
cmd /c npm run live:agent0
Remove-Item Env:\AGENT_0_PREPARE_ONLY
```

Register Agent 0 after `EmergenceRecorder.sol` is deployed:

```powershell
cd emergence-claim-core
$env:EMERGENCE_RECORDER_ADDRESS="0x..."
cmd /c npm run live:agent0
```

Required live env:

- `EMERGENCE_RECORDER_ADDRESS`
- one of `LIVE_AGENT_RPC_URL`, `MONAD_RPC_URL`, or `PHASE1A_RPC_URL`
- one of `LIVE_AGENT_PRIVATE_KEY`, `WALLET_PRIVATE_KEY`, or `DEPLOYER_PRIVATE_KEY`

Optional live env:

- `REVENUE_ROUTER_ADDRESS` defaults to `0x39158bC2cfCa2cCF70121EF72ed9a5fF1e084982`
- `LIVE_AGENT_MARKET_ADDRESS` defaults to `KURU_MON_USDC_ADDR`
- `LIVE_AGENT_MARKET_ID` defaults to `kuru:MON/USDC:spot`

## Boundaries

- ratification is recognition, not authorization
- this package creates evidence artifacts only
- operating surfaces must not consume these artifacts directly
- on-chain behavioral records are permanent evidence points, not consciousness claims
