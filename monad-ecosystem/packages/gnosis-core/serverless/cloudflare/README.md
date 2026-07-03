# Sovereign Agent Registry — Cloudflare Workers Deployment

Deploy the agent registry as a Cloudflare Edge Worker.

## Files

- `src/index.ts` — Worker entry point
- `src/agents.json` — static `AgentProfile[]` bundled at deploy time
- `wrangler.toml` — Wrangler config

## Setup

1. Install Wrangler:
   ```bash
   npm install -g wrangler
   ```

2. Authenticate:
   ```bash
   wrangler login
   ```

3. (Optional) Set bearer token secret:
   ```bash
   wrangler secret put REGISTRY_AUTH_TOKEN
   ```

4. Replace `src/agents.json` with your real `AgentProfile[]`, or wire a KV/R2 fetch in `src/index.ts`.

5. Deploy:
   ```bash
   wrangler deploy
   ```

## Dynamic data via Workers KV

Uncomment the KV binding in `wrangler.toml`, then in `src/index.ts`:

```typescript
const value = await env.REGISTRY_KV.get('agents');
return value ? JSON.parse(value) : [];
```

## Scheduler configuration

```bash
PLURALITY_PROVIDER=registry
AGENT_REGISTRY_URL=https://sovereign-agent-registry.YOUR_SUBDOMAIN.workers.dev/agents
AGENT_REGISTRY_TOKEN=your-bearer-token
```
