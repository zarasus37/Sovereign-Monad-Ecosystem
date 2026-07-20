# Sovereign Host Dockerfile
# Node 2: Express backend API + Cardia SSE + monad-mev engine

FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY monad-ecosystem/packages/sovereign-host/package.json ./
COPY monad-ecosystem/packages/sovereign-host/tsconfig.json ./
COPY monad-ecosystem/pnpm-workspace.yaml ./
COPY monad-ecosystem/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy source
COPY monad-ecosystem/packages/sovereign-host/src ./src

# Build
RUN pnpm run build

# Production image
FROM node:20-alpine AS production

WORKDIR /app

# Copy built artifacts
COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./

# Production dependencies only
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# Non-root user
RUN addgroup -g 1001 -S sovereign && \
    adduser -u 1001 -S sovereign -G sovereign
USER sovereign

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

# Start
CMD ["node", "dist/server.js"]