# Risk Engine

Monte Carlo-based risk evaluation for Base/Arbitrum cross-chain arbitrage opportunities.

## What It Does

- Consumes `risk.opportunity-candidate`
- Simulates inventory-based and bridge-based outcomes
- Publishes approved or rejected results to `risk.opportunity-evaluation`

## Current Runtime Profile

- `RISK_FIXED_COST_BPS=8`
- `RISK_MIN_EFFECTIVE_SPREAD_BPS=12`
- Bridge latency modeled as log-normal
- Small bridge failure probability remains in the simulation path

The wider runtime gates for spread, liquidity, and capacity are controlled upstream by `spread-scanner` and `opportunity-constructor`.

## Monte Carlo Model

- 10,000 simulations per opportunity by default
- Correlated price paths across the two active chains
- Gas, slippage, liquidity impact, and bridge costs deducted from expected value
- `p01Pnl` is the canonical 1st-percentile tail PnL metric used in approval decisions
- `maxDrawdownEstimate` is retained as a compatibility alias for downstream consumers

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

## Stress Matrix

Use the stress matrix as a sanity gate, not as a substitute for live data.

```bash
cmd /c npm run stress:matrix
cmd /c npm run stress:matrix:report
```

Artifacts:

- JSON report: `artifacts/stress-matrix.json`
- scenario gates: `src/tools/stress-gates.json`

The report is deterministic because the runner uses fixed seeds per scenario. This makes it suitable for regression testing and operator review.
