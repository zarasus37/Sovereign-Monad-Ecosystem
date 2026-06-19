# Commercial Stack Deployment Runbook

This runbook covers the public-facing commercial services:

- `api.<root-domain>`
- `billing.<root-domain>`
- `licenses.<root-domain>`

All three services can run on one Docker host behind Caddy.

## Prerequisites

Before deployment, you need:

1. one Ubuntu VPS
2. one root domain you control
3. DNS access for that domain
4. ports `80` and `443` open to the internet
5. real values in:
   - `.env.billing`
   - `.env.license-service`
   - `.env.edge`
6. host bootstrap values in `.env.host`

## Host Bootstrap

From `templates/commercial-stack` on the server:

```bash
cp .env.host.example .env.host
sudo ./bootstrap-ubuntu.sh
sudo -u <app-user> ./prepare-host.sh
```

This installs:

- Docker Engine
- Docker Compose plugin
- Git
- UFW
- fail2ban

It also:

- creates the deployment user
- creates the app root
- opens only `SSH`, `80`, and `443`
- enables Docker and fail2ban

`prepare-host.sh` also runs `provision-env.sh` so the billing and license env files inherit the public domains defined in `.env.edge`.

## DNS

Create three `A` records pointing to the same host:

- `api` -> `<server-ip>`
- `billing` -> `<server-ip>`
- `licenses` -> `<server-ip>`

## Environment Files

Fill these with real values:

- `.env.api`
- `.env.billing`
- `.env.license-service`
- `.env.edge`

Minimum required replacements:

- Stripe live secret and webhook secret
- Stripe live price IDs
- success, cancel, and portal URLs
- public license service URL
- root domain and the three subdomains
- ACME email for certificate issuance

Derived values managed by `provision-env.sh`:

- `CHECKOUT_SUCCESS_URL`
- `CHECKOUT_CANCEL_URL`
- `PORTAL_RETURN_URL`
- `PUBLIC_LICENSE_SERVER_URL`

You can seed the domain-linked env files with:

```bash
./seed-production-env.sh your-domain.com ops@your-domain.com
```

## First Bring-Up

From `templates/commercial-stack`:

```bash
./deploy-edge.sh
```

This starts:

- `smev-api`
- `smev-billing`
- `smev-license-service`
- `caddy`

## Customer and License Provisioning

Prepare seed files:

```bash
cp customer-seeds.example.json customer-seeds.json
cp license-seeds.example.json license-seeds.json
```

Then provision:

```bash
node ./provision-api-clients.mjs ./customer-seeds.json
node ./provision-licenses.mjs ./license-seeds.json
```

This updates:

- `templates/api/config/api-keys.json`
- `templates/license-service/config/licenses.json`
- `templates/billing/config/inquiries.json` continues capturing demo, fund, enterprise, and presale requests

## Verification

Once DNS has propagated and Caddy has obtained certificates, verify:

- `https://api.<root-domain>/health`
- `https://billing.<root-domain>/health`
- `https://licenses.<root-domain>/health`

Then verify:

- `GET /config` with a real API key
- `POST /evaluate`
- `POST /sales/request`
- Stripe webhook delivery to `https://billing.<root-domain>/webhooks/stripe`
- `POST /licenses/activate`
- `POST /licenses/validate`

## Rollback

To stop the public edge stack:

```bash
cd "${APP_ROOT}/repo/templates/commercial-stack"
docker compose -f docker-compose.yml -f docker-compose.edge.yml down
```

To recover license and API-key state:

```bash
./restore-state.sh /path/to/backups/<timestamp>
```

## Notes

- The edge overlay is structurally validated in this repo.
- Full public verification still depends on a real domain, DNS propagation, and real Stripe secrets.
- Keep the commercial stack separate from the Base/Arbitrum artifact deployment path.
- `deploy-edge.sh` performs a pre-deploy backup of API-key and license state before each rollout.
