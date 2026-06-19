# monad-market-agent

Historical only. This package is retained as a reference artifact from the original Monad-side topology and is not part of the active Base/Arbitrum runtime.

Use the active services instead:

- `base-market-agent`
- `arbitrum-market-agent`
- `arb-bot`

If this package is reactivated for Monad work, the current hardening assumptions are:

- do not rely on testnet fallback endpoints for mainnet operation
- use explicit `MONAD_WS_FALLBACKS` only if you actually have secondary provider capacity
- keep `MARKET_FETCH_CONCURRENCY=1` unless your provider tier supports parallel reads safely
- keep `MIN_FETCH_INTERVAL_MS` conservative to avoid rate-limit churn
- use `RPC_CONNECT_TIMEOUT_MS` so dead endpoints fail fast instead of hanging startup

For migration status and current runtime details, see `docs/MIGRATION-BASE-ARB.md`.
