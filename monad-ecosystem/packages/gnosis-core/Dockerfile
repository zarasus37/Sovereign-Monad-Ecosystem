# Gnosis Core Plurality Scheduler
# Production container for @sovereign/gnosis-core

FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY monad-ecosystem/packages/gnosis-core/package.json ./monad-ecosystem/packages/gnosis-core/package.json
COPY monad-ecosystem/packages/sovereign-bus/package.json ./monad-ecosystem/packages/sovereign-bus/package.json
COPY monad-ecosystem/packages/sovereign-types/package.json ./monad-ecosystem/packages/sovereign-types/package.json
RUN pnpm install --frozen-lockfile
COPY monad-ecosystem/packages/gnosis-core/src ./monad-ecosystem/packages/gnosis-core/src
COPY monad-ecosystem/packages/gnosis-core/tsconfig.json ./monad-ecosystem/packages/gnosis-core/tsconfig.json
COPY monad-ecosystem/packages/sovereign-bus/src ./monad-ecosystem/packages/sovereign-bus/src
COPY monad-ecosystem/packages/sovereign-types/src ./monad-ecosystem/packages/sovereign-types/src
WORKDIR /app/monad-ecosystem/packages/gnosis-core
RUN pnpm run build

FROM base AS production
WORKDIR /app/monad-ecosystem/packages/gnosis-core
COPY --from=build /app/monad-ecosystem/packages/gnosis-core/dist ./dist
COPY --from=build /app/monad-ecosystem/packages/gnosis-core/package.json ./
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/monad-ecosystem/packages/sovereign-bus /app/monad-ecosystem/packages/sovereign-bus
COPY --from=build /app/monad-ecosystem/packages/sovereign-types /app/monad-ecosystem/packages/sovereign-types
ENV PLURALITY_INTERVAL_MS=900000
ENV PLURALITY_THRESHOLD=0.6
ENV PLURALITY_SOURCE=gnosis-core-plurality
CMD ["node", "dist/cli.js"]
