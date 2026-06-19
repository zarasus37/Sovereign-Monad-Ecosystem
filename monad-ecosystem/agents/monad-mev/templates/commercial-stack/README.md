# Commercial Stack Template

This compose bundle stands up the three public-facing commercial services:

- `smev-api` on port `3000`
- `smev-billing` on port `3010`
- `smev-license-service` on port `4010`

Compose files are split by intent:

- `docker-compose.yml`: base service definition with no published host ports
- `docker-compose.local.yml`: local development bind policy
- `docker-compose.prod.yml`: production-oriented localhost-only bind policy
- `docker-compose.edge.yml`: public internet edge with Caddy on `80/443`

For the full public deployment checklist, use [DEPLOYMENT-RUNBOOK.md](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/DEPLOYMENT-RUNBOOK.md).
For fresh Ubuntu hosts, use:

- [bootstrap-ubuntu.sh](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/bootstrap-ubuntu.sh)
- [prepare-host.sh](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/prepare-host.sh)
- [deploy-edge.sh](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/deploy-edge.sh)
- [provision-env.sh](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/provision-env.sh)
- [seed-production-env.sh](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/seed-production-env.sh)
- [seed-production-env.ps1](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/seed-production-env.ps1)
- [provision-api-clients.mjs](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/provision-api-clients.mjs)
- [provision-licenses.mjs](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/provision-licenses.mjs)
- [backup-state.sh](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/backup-state.sh)
- [restore-state.sh](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/restore-state.sh)
- [.env.host.example](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/.env.host.example)
- [customer-seeds.example.json](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/customer-seeds.example.json)
- [license-seeds.example.json](C:/Users/crisc/Dev/agents/monad-mev/templates/commercial-stack/license-seeds.example.json)

## Fastest Path

From `templates/commercial-stack` on Windows:

```powershell
.\up.ps1
.\verify.ps1
```

That will:

- prepare `.env.api`, `.env.billing`, and `.env.license-service` from the example files if they do not exist
- build and start the three services
- verify API, billing, and license-service endpoints locally

To stop the stack:

```powershell
.\down.ps1
```

## Production Discipline

Before a real deployment:

```powershell
.\backup-state.ps1
.\preflight.ps1
```

`preflight.ps1` checks:

- Docker engine availability
- required env files exist
- Starter/Pro Stripe keys, price IDs, and URLs are no longer placeholders
- optional Fund/Enterprise Stripe price IDs are only enforced if you actually set them
- license-service URL is no longer a placeholder
- shared state files exist

If you only want to smoke-test locally with example values:

```powershell
.\preflight.ps1 -AllowPlaceholders
```

For the public edge deployment path, also prepare:

```powershell
copy .env.edge.example .env.edge
.\preflight.ps1 -Edge
```

## Setup

Copy the example env files:

```bash
copy .env.api.example .env.api
copy .env.billing.example .env.billing
copy .env.license-service.example .env.license-service
copy .env.edge.example .env.edge
```

Then build and start:

```bash
docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

For a production-oriented bind policy that only exposes the services on localhost:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

For a public internet deployment with Caddy handling TLS and routing:

```bash
docker-compose -f docker-compose.yml -f docker-compose.edge.yml up -d --build
```

If you want to refresh existing env files from the examples again:

```powershell
.\up.ps1 -RefreshEnvFiles
```

For the localhost-only production overlay:

```powershell
.\up.ps1 -Prod
.\preflight.ps1
.\verify.ps1
.\down.ps1 -Prod
```

For the public edge overlay:

```powershell
.\up.ps1 -Edge
.\down.ps1 -Edge
```

For a fresh Ubuntu VPS, use:

```bash
cp .env.host.example .env.host
sudo ./bootstrap-ubuntu.sh
sudo -u <app-user> ./prepare-host.sh
sudo -u <app-user> ./deploy-edge.sh
```

To sync derived public URLs from `.env.edge` into billing and license env files:

```bash
./provision-env.sh
```

To seed production env files from a root domain:

```bash
./seed-production-env.sh your-domain.com ops@your-domain.com
```

```powershell
.\seed-production-env.ps1 -RootDomain your-domain.com -AcmeEmail ops@your-domain.com
```

To create and restore Linux-side backups:

```bash
./backup-state.sh
./restore-state.sh ./backups/<timestamp>
```

To seed first customer records and Fund/Enterprise license records:

```bash
cp customer-seeds.example.json customer-seeds.json
cp license-seeds.example.json license-seeds.json
node ./provision-api-clients.mjs ./customer-seeds.json
node ./provision-licenses.mjs ./license-seeds.json
```

## Service roles

- `smev-api`: evaluation API for Starter and Pro buyers
- `smev-billing`: Stripe checkout, portal, and webhook handling
- `smev-license-service`: activation and validation server for Fund and Enterprise deployments

## Shared state

The API and billing services share the same API-key file through the mounted `../api/config` directory.
Billing also persists first-party sales, demo, and presale inquiries through the mounted `../billing/config` directory.

## Edge deployment

The edge overlay adds a `caddy` service that terminates HTTPS and routes:

- `{$API_DOMAIN}` -> `smev-api:3000`
- `{$BILLING_DOMAIN}` -> `smev-billing:3010`
- `{$LICENSE_DOMAIN}` -> `smev-license-service:4010`

Place the real values in `.env.edge` before deployment. Caddy will obtain and renew certificates automatically once the domains resolve to the host.
Use `.env.host` to control the target app root, deployment user, branch, and SSH port on the VPS.
`provision-env.sh` keeps `CHECKOUT_*`, `PORTAL_RETURN_URL`, and `PUBLIC_LICENSE_SERVER_URL` aligned with the chosen subdomains.
`provision-api-clients.mjs` and `provision-licenses.mjs` perform deterministic create/update merges into the shared JSON stores.

## Local Verification

Verification uses:

- API key: `starter-demo-key`
- license key: `SMEV-ENTERPRISE-BETA`
- fixed machine id: `commercial-stack-verify`

The fixed machine id avoids consuming a new activation slot on every verification run.
Verification also posts a sample `POST /sales/request` payload so lead capture is exercised alongside API, billing health, and licensing.

## Endpoints

- API: `http://127.0.0.1:3000`
- Billing: `http://127.0.0.1:3010`
- License service: `http://127.0.0.1:4010`

For real deployments, put a reverse proxy or tunnel in front of these localhost-bound ports rather than exposing them directly.
