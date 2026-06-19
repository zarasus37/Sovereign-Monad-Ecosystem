# Spread Scanner

Consumes price snapshots from Monad and Ethereum, calculates cross-chain spreads, emits SpreadSignal events.

## Topics

- Input: `market.monad.price-snapshot`, `market.eth.price-snapshot`
- Output: `market.spread.signal`

## Run

```bash
npm install
cp .env.example .env
npm run dev
```
