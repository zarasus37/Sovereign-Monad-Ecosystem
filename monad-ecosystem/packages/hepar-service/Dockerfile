# Sovereign Hepar Service — TypeScript forensic chain scanner
# Exposes POST /api/v1/hepar on port 3003
# Build from repository root:
#   docker build -f monad-ecosystem/packages/hepar-service/Dockerfile -t sovereign-hepar .

FROM node:20-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.6.0 --activate

WORKDIR /repo

# Workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Only the packages hepar-service depends on
COPY packages/sovereign-types ./packages/sovereign-types
COPY packages/hepar-service   ./packages/hepar-service

RUN pnpm install \
  && pnpm --filter @sovereign/types build \
  && pnpm --filter @sovereign/hepar-service build

FROM node:20-bookworm-slim AS production

RUN corepack enable && corepack prepare pnpm@9.6.0 --activate \
  && apt-get update && apt-get install -y --no-install-recommends wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

COPY --from=builder /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages

ENV NODE_ENV=production
ENV PORT=3003

RUN groupadd -g 1002 hepar && useradd -u 1002 -g hepar -m hepar \
  && chown -R hepar:hepar /repo
USER hepar

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3003/health > /dev/null || exit 1

WORKDIR /repo/packages/hepar-service
CMD ["node", "dist/server.js"]
