# License Service Template

This is a minimal file-backed activation service for Fund and Enterprise deployments.

## Endpoints

- `POST /licenses/activate`
- `POST /licenses/validate`
- `GET /health`

For public deployment behind the commercial edge stack, this service should sit behind:

- `https://licenses.<root-domain>`

## Local Run

```bash
npm install
npm run dev
```

## Activation Request

```json
{
  "licenseKey": "SMEV-FUND-ALPHA",
  "machineId": "host-01"
}
```

If the client sends `Accept: text/plain`, the activation endpoint responds with `.env`-formatted lines suitable for `scripts/activate-license.sh`.

## Example checks

```bash
curl http://127.0.0.1:4010/health
curl -X POST http://127.0.0.1:4010/licenses/activate \
  -H "Content-Type: application/json" \
  -d "{\"licenseKey\":\"SMEV-ENTERPRISE-BETA\",\"machineId\":\"commercial-stack-verify\"}"
```

For the cleanest local path, prefer the combined stack in `templates/commercial-stack/`.
Use `docker-compose.yml` plus `docker-compose.local.yml` for local checks, or `docker-compose.prod.yml` for localhost-only production binding.
