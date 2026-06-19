# Sovereign MEV Engine — Commercial Module Boundaries

> Last Updated: 2026-03-18
> Purpose: Define what stays private vs what is licensable

---

## Layer 1: Community (Public/Source-Available)

### Included
- `docs/` — Architecture summaries, screenshots, runbooks
- `README.md` — High-level overview
- `LICENSE.commercial.md` — Commercial license text
- `monitoring/dashboard.py` — Generic dashboard framework (no strategy-specific logic)
- Any future stripped demo packages

### Purpose
Showcase the system capabilities without exposing edge.

---

## Layer 2: Licensed (Commercial)

### Included
| Module | Description |
|--------|-------------|
| `base-market-agent/` | Generic venue adapter scaffolding (Aerodrome) |
| `arbitrum-market-agent/` | Generic venue adapter scaffolding (Camelot) |
| `spread-scanner/` | Event-driven service architecture, Kafka topic pipeline |
| `opportunity-constructor/` | Generic risk/opportunity framework |
| `risk-engine/` | Monte Carlo simulation framework |
| `portfolio-manager/` | Position sizing and exposure management |
| `arb-bot/` | Execution orchestration, guarded-live override pattern |
| `bridge-agent/` | Cross-chain coordination scaffolding |
| `model-feedback-logger/` | Replay / feedback plumbing |
| `monitoring/` | Alerting and dashboard framework |
| `alert-rules/` | Generic alerting rules |
| `stress-monitor/` | Generic stress detection |
| `docker-compose.*.yml` | Deployment and orchestration patterns |
| `scripts/` | Operational tooling (health, balances, topic-flow, status) |

### What's Protected
- Generic adapter patterns, not venue-specific execution improvements
- Orchestration patterns, not route ranking/timing heuristics
- Dashboard framework, not proprietary metrics

---

## Layer 3: Private (Alpha)

### Excluded from License
| Module | Description |
|--------|-------------|
| `monad-arb-bot/` | Monad-specific execution logic |
| `monad-market-agent/` | Monad-specific market feed |
| `eth-market-agent/` | Ethereum-specific market feed |
| `eth-arb-bot/` | Ethereum-specific execution logic |
| `bridge-exec-bot/` | Bridge execution with proprietary heuristics |
| Any venue-specific execution improvements added later |
| Proprietary fill-quality heuristics |
| Route ranking and timing logic |
| Proprietary datasets or labeling |

---

## Secrets & Configuration

### Licensee Separation
- `.env` — Never included (operator-specific)
- `.env.example` — Template with placeholder values
- Configuration must be customer-provided

### Recommended Customer Deployment
```
/deploy/
  docker-compose.mainnet.yml
  docker-compose.licensed.yml
  .env.example
  .env.license
  scripts/
    activate-license.sh
    validate-license.sh
    deploy-licensed.sh
    health-check.sh
```

---

## Support Structure

### Included in License
- Deployment consultation (limited)
- Architecture review
- Bug fixes for licensed modules
- Version upgrades for licensed modules

### Not Included
- Venue adapter customization (sold separately)
- Strategy-specific modifications
- Real-time support (retainer tier)
- Custom integrations (sold separately)

---

## Versioning

- Licensed modules follow semver
- Private modules track internally
- Breaking changes to licensed API documented in CHANGELOG.commercial.md
