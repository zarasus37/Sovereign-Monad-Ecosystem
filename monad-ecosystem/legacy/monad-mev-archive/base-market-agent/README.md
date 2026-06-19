# base-market-agent

Base price feed agent for the Base/Arbitrum cross-chain MEV stack.

Subscribes to Base blocks via WebSocket, reads Aerodrome pool state and token balances, computes realized volatility, and publishes Base price snapshots to Kafka.

## Prerequisites

- Node.js 22+
- Kafka broker (local or remote)
- Base mainnet RPC WebSocket URL
- Aerodrome contract addresses on Base

## Setup

1. **Install dependencies**

```bash
cd base-market-agent
npm install
```

2. **Configure environment**

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `BASE_WS_URL` or `CHAIN_A_WS_URL` | WebSocket URL for Base RPC |
| `AERODROME_ETH_USDC_POOL` | Aerodrome ETH/USDC pool address on Base |
| `KAFKA_BROKERS` | Kafka broker addresses (comma-separated) |

Optional variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_RPC_URL` or `CHAIN_A_RPC_URL` | empty | HTTP RPC URL for Base |
| `AERODROME_ROUTER_ADDR` | empty | Aerodrome router address |
| `KAFKA_TOPIC` | `market.base.price-snapshot` | Kafka topic for price snapshots |
| `KAFKA_CLIENT_ID` | `base-market-agent` | Kafka client ID |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |

## Running

### Development (ts-node)

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## Output

The agent publishes Base snapshot events to the configured Kafka topic with this structure:

```json
{
  "meta": {
    "eventId": "uuid-v4",
    "eventType": "BasePriceSnapshot",
    "version": 1,
    "timestampMs": 1234567890,
    "source": "base-market-agent"
  },
  "chainId": "BASE",
  "marketId": "aerodrome:ETH/USDC:spot",
  "baseAsset": "ETH",
  "quoteAsset": "USDC",
  "priceMid": 2500.50,
  "bestBid": 2500.25,
  "bestAsk": 2500.75,
  "liquidity10bps": "500000.00",
  "liquidity50bps": "2000000.00",
  "realizedVol1m": 0.45,
  "realizedVol5m": 0.38,
  "realizedVol1h": 0.32,
  "blockNumber": 12345
}
```

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   Base RPC      │────▶│ base-market  │────▶│   Kafka     │
│  (WebSocket)    │     │   -agent     │     │  Producer   │
└─────────────────┘     └──────────────┘     └─────────────┘
  │                      │
  │                      ▼
  └────────────────────▶┌──────────────┐
            │  Aerodrome   │
            │    Pools     │
            └──────────────┘

The adapter validates the configured pool address and falls back to a known-good ETH/USDC pool when the configured address is invalid.
```

## Graceful Shutdown

The agent handles `SIGINT` and `SIGTERM` signals gracefully:
- Removes block listener
- Disconnects Kafka producer
- Disconnects RPC WebSocket

## Troubleshooting

### Kafka connection errors

- Ensure Kafka broker is running
- Check `KAFKA_BROKERS` format (comma-separated, no spaces)
- Verify network connectivity

### RPC connection errors

- Verify `BASE_WS_URL` or `CHAIN_A_WS_URL` is correct
- Verify the Base endpoint is reachable from the host or container
- Ensure WebSocket connectivity

### Missing price data

- Verify Aerodrome contract addresses are correct
- Check that contracts are deployed on Base mainnet
- Review logs for specific contract call errors
