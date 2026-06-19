# SMMEVAE Architecture

## Purpose

This document describes the Base/Arbitrum-oriented architecture artifacts present in the repo, the intended topic flow between services, and the role of each component in that topology.

Use the separate `sovereign-monad` repo for canonical phase and blocker status: `https://github.com/zarasus37/sovereign-monad`.

## Base/Arbitrum Topology Artifact

The repo contains a Base/Arbitrum stack organized around Kafka-backed event flow in `DRY_RUN=true`. This should be read as an implementation artifact, not as proof that the full program has advanced phases.

### Market inputs

1. `base-market-agent` publishes `market.base.price-snapshot`.
2. `arbitrum-market-agent` publishes `market.arbitrum.price-snapshot`.
3. `stress-monitor` emits stress and health signals.

### Decision path

1. `spread-scanner` consumes both market topics and emits `market.spread.signal`.
2. `opportunity-constructor` emits `risk.opportunity-candidate`.
3. `risk-engine` evaluates EV and tail risk, then emits `risk.opportunity-evaluation`.
4. `portfolio-manager` emits `execution.execution-plan`.
5. `arb-bot` emits `execution.execution-result`.

### Observability path

1. `model-feedback-logger` writes JSONL logs.
2. `monitoring/dashboard.py` renders operator-facing summaries.
3. `alert-rules` emits alert notifications.

## Topic Map

### Market layer

1. `market.base.price-snapshot`
2. `market.arbitrum.price-snapshot`
3. `market.spread.signal`
4. `market.stress-signal`

### Risk and execution layer

1. `risk.opportunity-candidate`
2. `risk.opportunity-evaluation`
3. `execution.execution-plan`
4. `execution.execution-result`

## Risk And Approval Model

Upstream gates include:

1. minimum spread
2. minimum liquidity at 10 bps depth
3. minimum executable capacity
4. minimum constructed trade size

Risk-engine gates include:

1. positive expected value
2. expected value above configured threshold
3. Sharpe-like metric above configured threshold
4. tail-loss estimate within configured maximum loss percentage

Typical repo-level validation profile:

1. `MIN_SPREAD_BPS=12`
2. `MIN_LIQUIDITY_10BPS_USD=750`
3. `MIN_CAPACITY_USD=3000`
4. `MIN_SIZE_USD=250`
5. `RISK_FIXED_COST_BPS=8`
6. `RISK_MIN_EFFECTIVE_SPREAD_BPS=12`
7. `MAX_SINGLE_TRADE_PERCENT=10`
8. `MAX_SLIPPAGE_BPS=50`

This is a repo validation profile, not a canonical live-capital approval profile.

## Operational Reality

The repo contains a coherent Base/Arbitrum path, but canonical program status remains constrained by the MOF and should not be inferred from this document alone.

1. Market data flow may exist for this path.
2. Downstream flow may become sparse under realistic thresholds.
3. That sparsity can be the correct outcome when executable depth is thin.
4. Live execution readiness and broader program completion are separate questions from repo-local topology alignment.

## Legacy Reference Artifacts

The following paths are retained intentionally and are not part of the canonical active system:

1. `monad-market-agent`
2. `eth-market-agent`
3. `monad-arb-bot`
4. `eth-arb-bot`
5. `bridge-exec-bot`
6. `docker-compose.yml`
7. `docker-compose.testnet.yml`
8. `docker-compose.prod.yml`
