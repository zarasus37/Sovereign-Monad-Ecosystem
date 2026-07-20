# Sovereign Host — monorepo-aware production image (Vector Final Sequence / The Breath)
#
# Build from repository root:
#   docker build -f monad-ecosystem/packages/sovereign-host/Dockerfile -t sovereign-host .
#
# Runtime: node dist/server.js  (PORT default 3001)

FROM node:20-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.6.0 --activate

WORKDIR /repo

# Workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Minimal package set for @sovereign/host + its workspace graph
COPY monad-ecosystem/packages/sovereign-types ./monad-ecosystem/packages/sovereign-types
COPY monad-ecosystem/packages/sovereign-bus ./monad-ecosystem/packages/sovereign-bus
COPY monad-ecosystem/packages/gate-acl ./monad-ecosystem/packages/gate-acl
COPY monad-ecosystem/packages/cardia-funding-stream ./monad-ecosystem/packages/cardia-funding-stream
COPY monad-ecosystem/packages/sovereign-host ./monad-ecosystem/packages/sovereign-host

# Install and build only what the host needs
RUN pnpm install --filter @sovereign/host... --frozen-lockfile \
  && pnpm --filter @sovereign/types build \
  && pnpm --filter @sovereign/bus build \
  && pnpm --filter @sovereign/gate-acl build \
  && pnpm --filter @sovereign/cardia-funding-stream build \
  && pnpm --filter @sovereign/host build

FROM node:20-bookworm-slim AS production

RUN corepack enable && corepack prepare pnpm@9.6.0 --activate \
  && apt-get update && apt-get install -y --no-install-recommends wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

COPY --from=builder /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/monad-ecosystem/packages ./monad-ecosystem/packages

ENV NODE_ENV=production
ENV PORT=3001

RUN groupadd -g 1001 sovereign && useradd -u 1001 -g sovereign -m sovereign \
  && chown -R sovereign:sovereign /repo
USER sovereign

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3001/health >/dev/null || exit 1

WORKDIR /repo/monad-ecosystem/packages/sovereign-host
CMD ["node", "dist/server.js"]
