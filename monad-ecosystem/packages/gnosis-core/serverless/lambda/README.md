# Sovereign Agent Registry — AWS Lambda Deployment

Deploy the agent registry as an AWS Lambda function behind API Gateway v2.

## Files

- `src/index.ts` — Lambda handler
- `tsconfig.json` — TypeScript config

## Build + deploy

1. Build the workspace dependency first:
   ```bash
   cd ../..
   pnpm --filter @sovereign/gnosis-core run build
   ```

2. Build this package:
   ```bash
   cd serverless/lambda
   pnpm install
   pnpm run build
   ```

3. Package `dist/` and `node_modules/@sovereign/gnosis-core/dist` for Lambda (use a bundler like `esbuild` or zip manually).

4. Deploy with AWS CLI, Serverless Framework, or Terraform:
   ```bash
   aws lambda create-function \
     --function-name sovereign-agent-registry \
     --runtime nodejs20.x \
     --handler dist/index.handler \
     --zip-file fileb://lambda.zip \
     --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-role \
     --environment Variables='{REGISTRY_AUTH_TOKEN=your-token,REGISTRY_DATA_PATH=/tmp/agents.json}'
   ```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `REGISTRY_DATA_PATH` | `/tmp/agents.json` | Path to JSON file with `AgentProfile[]` |
| `REGISTRY_AUTH_TOKEN` | — | Optional bearer token required on `/agents` |

The Lambda filesystem (`/tmp`) is writable but ephemeral. For persistent data, fetch `agents.json` from S3 at cold start or use an external store.

## Scheduler configuration

```bash
PLURALITY_PROVIDER=registry
AGENT_REGISTRY_URL=https://YOUR_API_GATEWAY_ID.execute-api.YOUR_REGION.amazonaws.com/agents
AGENT_REGISTRY_TOKEN=your-bearer-token
```
