# Bot Template Package

## Quick Start

```bash
# 1. Extract
unzip mev-bot-template.zip

# 2. Configure
cd mev-bot-template
cp .env.example .env
# Edit .env with your settings

# 3. Build
docker compose build

# 4. Run
docker compose up -d

# 5. Monitor
docker compose logs -f
```

## What's Inside

```
mev-bot-template/
├── src/
│   ├── config.ts      # Configuration
│   ├── index.ts      # Main entry
│   ├── executor.ts   # Trade execution
│   └── utils/
│       └── logger.ts
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Configuration

Edit `.env`:

```env
KAFKA_BROKERS=kafka:29092
CHAIN_A_RPC_URL=https://...
CHAIN_B_RPC_URL=https://...
PRIVATE_KEY=0x...
DRY_RUN=true
MIN_SPREAD_BPS=5
```

## Customization

### Add New Market
1. Create adapter in `src/adapters/`
2. Update config
3. Rebuild

### Change Trading Pair
1. Update config.ts
2. Rebuild

## Support

- Email: [Coming Soon]
- Discord: DM for help

## License

Commercial use only. No redistribution.
