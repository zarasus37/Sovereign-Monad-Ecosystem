# Issue: Azure Container App inbound port mapping (target port 3001)

> **Source:** `docs/P0_ORGANS_RESOLUTION_2026-10-13.md` and the corrected
> monorepo-root `Dockerfile` for `cardia-testnet-host`. The Dockerfile
> sets `ENV PORT=3001` and `EXPOSE 3001`; the host's `server.ts` defaults
> to 3001. **The Azure Container App's `targetPort` must be set to 3001
> for ingress to reach the app** — Azure's default is 8080.

## Problem

The host image runs on port 3001. If the Azure Container App is
configured with `targetPort: 8080` (the Azure default), the ingress
will probe the wrong port and the container will fail its liveness
check. The first deploy after the host is re-imaged will fail with
`502 Bad Gateway` or `Container is unhealthy` even if the image is
correct.

## Success criteria

- `curl -fsS https://<host>/health` returns 200 with `{"status":"ALIVE"}`.
- The ACA's liveness probe (`/health`) reports healthy.
- `curl -H "Authorization: Bearer $TOKEN" https://<host>/health/details`
  returns 200 with `cardia_engine: { mounted: true, live: true }`.
- The `pnpm testnet:cycle` workflow's verification step exits 0.

## Action items

- [ ] **Verify ACA `properties.configuration.ingress.targetPort` is 3001**
  on `cardia-testnet-host`. The current value is unknown — read it before
  any deploy.
- [ ] **If targetPort is not 3001**, update with:
  ```bash
  az containerapp ingress update \
    --name cardia-testnet-host \
    --resource-group testnet-infrastructure-rg \
    --target-port 3001
  ```
- [ ] **Update ACA's liveness + readiness probes** to point at the new
  port:
  ```bash
  az containerapp probe update \
    --name cardia-testnet-host \
    --resource-group testnet-infrastructure-rg \
    --probe-type liveness --http-get-path /health
  ```
- [ ] **Document the chosen port in `docs/DEPLOY.md`** (create the file
  if it doesn't exist). Anyone reading the project should know:
  - Dockerfile `EXPOSE 3001` / `ENV PORT=3001`
  - Host `server.ts` default 3001
  - ACA `targetPort` 3001
  - All three must agree.
- [ ] **Run the `pnpm testnet:cycle` workflow** end-to-end against the
  deployed host and verify exit 0 with PASS verdict.

## Related

- `Dockerfile` (new, monorepo-root) — sets `PORT=3001` / `EXPOSE 3001`
- `monad-ecosystem/packages/sovereign-host/src/server.ts` — `const PORT = Number(process.env.PORT) || 3001`
- `.github/workflows/testnet-deploy.yml` — the deploy workflow that
  pushes the image and runs the verification cycle
- `docs/P0_ORGANS_RESOLUTION_2026-10-13.md` — the organs/ audit that
  surfaced `cardia-activation-core` and led to the funding engine wiring
- `docs/PROJECT_STATE.md` § "Go-Live status" — the prior Azure state
  (3 months unconfirmed; needs re-verification)

## Priority

**This week.** Blocking the first real testnet cycle.
