# Sovereign MEV Demo Package

> DISCLAIMER: This package is for evaluation only. It contains no live execution logic, no private market connectors, and no real RPC dependencies.

This demo showcases a buyer-safe version of the event-driven pipeline:
synthetic market feeds -> spread scanner -> risk evaluation.

---

## What This Demo Shows

`yes` Event-driven microservices architecture
`yes` Synthetic price generation with realistic spread motion
`yes` Kafka pipeline for prices -> opportunity candidates -> evaluations
`yes` Docker Compose deployment pattern
`yes` Real-time approve/reject decisions from the demo risk engine

`no` Real trading strategies
`no` Live execution logic
`no` Private route optimization or venue adapters
`no` Production secrets or paid infrastructure

---

## Quick Start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Start infrastructure and demo services
docker compose -f docker-compose.demo.yml up --build

# 3. Watch spreads being evaluated in real time
docker compose -f docker-compose.demo.yml logs -f demo-risk-engine demo-scanner

# 4. Stop
docker compose -f docker-compose.demo.yml down
```

---

## Architecture

```text
Demo Market A ---> market.demo-a.snapshot ----\
                                               \
                                                --> Demo Scanner --> risk.demo.opportunity-candidate --> Demo Risk Engine
                                               /
Demo Market B ---> market.demo-b.snapshot ----/
```

---

## Demo Services

| Service | Purpose |
|---------|---------|
| `demo-market-agent-a` | Publishes synthetic price snapshots for Chain A |
| `demo-market-agent-b` | Publishes synthetic price snapshots for Chain B |
| `demo-scanner` | Consumes both feeds, calculates spread, emits opportunity candidates |
| `demo-risk-engine` | Evaluates opportunities and logs EV, Sharpe-like, size, and approval |

---

## What Buyers Should Look For

Run:

```bash
docker compose -f docker-compose.demo.yml logs -f demo-risk-engine
```

Typical output will show:

```text
[Demo Risk Engine] ACCEPT opportunity=... mode=inventory_based eff=18.42bps ev=1.84 sharpe=1.09 size=$1000.00
[Demo Risk Engine] REJECT opportunity=... mode=bridge_based eff=9.87bps ev=-5.51 sharpe=-2.41 size=$0.00
```

That gives a prospect something tangible: synthetic market dislocations entering the same style of evaluation flow that a licensed deployment uses.

---

## Configuration

Edit `.env`:

```env
# Kafka
KAFKA_BROKERS=localhost:29092

# Demo pricing
DEMO_PRICE_A=2500.00
DEMO_PRICE_B=2502.50
DEMO_SPREAD_THRESHOLD_BPS=1
DEMO_BRIDGE_DELAY_MS=4000
DEMO_SIZE_SUGGESTION_USD=1000

# Interval
PUBLISH_INTERVAL_MS=2000
```

---

## What's Different from Production

| Feature | Demo | Production |
|---------|------|------------|
| Data Source | Synthetic price simulator | Real RPC and venue adapters |
| Execution | None | Real DEX / bridge execution |
| Risk Assessment | Deterministic evaluation engine | Full runtime evaluation stack |
| Slippage Handling | Simplified via spread and liquidity assumptions | Venue-aware |
| Connectivity | Offline-safe | External infrastructure required |

---

## Directory Structure

```text
demo-package/
|-- docker-compose.demo.yml
|-- .env.example
|-- README.md
|-- demo-market-agent/
|-- demo-scanner/
`-- demo-risk-engine/
```

---

## License

This demo package is provided under the Evaluation License terms in `../LICENSE.commercial.md`. It is for demonstration and evaluation only, not for production use.

---

## Support

For questions about the demo:
- Review the architecture in the main `docs/` directory
- Check deployment patterns in main `docker-compose.*.yml` files
- Contact for licensing inquiries

---

*This demo contains no real trading logic. Past performance does not guarantee future results. Not financial advice.*
