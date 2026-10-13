# ==========================================
# Stage 1: Build Workspace with Corepack
# ==========================================
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@12.11.2 --activate

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @sovereign/host build
RUN pnpm prune --prod --no-optional

# ==========================================
# Stage 2: Minimal Production Runtime
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /repo

ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodeapp

COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages

RUN chown -R nodeapp:nodejs /repo
USER nodeapp

EXPOSE 3001

WORKDIR /repo/packages/sovereign-host
CMD ["node", "dist/server.js"]
