# arb-bot

Active Base/Arbitrum execution service.

## Current behavior

- consumes `execution.execution-plan`
- validates plan freshness and deadline
- preserves real asset, direction, venue, and price context
- prepares venue-specific swap legs through the adapter layer
- builds real router calldata for Aerodrome and Camelot
- reconciles receipt logs into wallet token deltas and realized USDC PnL
- checks live-mode chain IDs and inventory prerequisites
- fails closed when live execution is not explicitly enabled
- fails closed for `bridge_based` plans in the active runtime

## Important limit

The service now contains venue-specific router encoding for:

- Aerodrome `swapExactTokensForTokens` on Base
- Camelot `swapExactTokensForTokensSupportingFeeOnTransferTokens` on Arbitrum

Submission remains guarded:

- `ENABLE_LIVE_EXECUTION=true` enables live-path validation
- `ENABLE_SWAP_SUBMISSION=true` allows actual router transaction submission
- `ENABLE_AUTO_APPROVE=true` allows onchain ERC-20 approvals when router allowance is insufficient

Inventory for ETH venue legs is treated as `WETH` onchain. Native ETH is still checked separately for gas balance only.
The service now records partial-failure truth if one submitted leg lands and the other does not.

## Remaining limit

The bot can now submit and reconcile router calls, but it does not yet contain automatic hedge/recovery logic for one-leg failure scenarios. Partial execution is recorded accurately; it is not automatically neutralized.

## Environment

Copy `.env.example` to `.env` and set:

- `DRY_RUN=true` for validation mode
- `ENABLE_LIVE_EXECUTION=true` only for guarded funded sessions
- `ENABLE_SWAP_SUBMISSION=true` only when router calls should actually be sent
- `ENABLE_AUTO_APPROVE=true` only when the bot is allowed to create ERC-20 approvals
- `EXPECTED_CHAIN_A_ID=8453`
- `EXPECTED_CHAIN_B_ID=42161`
- `AERODROME_ROUTER_ADDR`
- `AERODROME_FACTORY_ADDR`
- `CAMELOT_ROUTER_ADDR`
- `CAMELOT_REFERRER_ADDR`
- `MAX_PLAN_AGE_MS`
- `MIN_GAS_BALANCE_ETH`

## Tests

```bash
npm test
```
