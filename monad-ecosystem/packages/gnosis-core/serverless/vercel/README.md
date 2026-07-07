# Sovereign Agent Registry — Vercel Serverless Deployment

Deploy the agent registry as Vercel Node.js functions.

## Files

- `api/agents.ts` — serves `AgentProfile[]` from `REGISTRY_DATA_PATH`
- `api/health.ts` — liveness check
- `vercel.json` — route mapping and environment

## Setup

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Set the secret bearer token:
   ```bash
   vercel secrets add sovereign-registry-token "your-bearer-token"
   ```

3. Deploy:
   ```bash
   vercel --prod
   ```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `REGISTRY_DATA_PATH` | `/tmp/agents.json` | Path to the JSON file containing `AgentProfile[]` |
| `REGISTRY_AUTH_TOKEN` | (from Vercel secret) | Optional bearer token required on `/agents` |

Vercel's filesystem is ephemeral; upload `agents.json` via the Vercel dashboard or read it from an external store (S3, KV) if it changes at runtime.

## Scheduler configuration

```bash
PLURALITY_PROVIDER=registry
AGENT_REGISTRY_URL=https://your-project.vercel.app/agents
AGENT_REGISTRY_TOKEN=your-bearer-token
```
