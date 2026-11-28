# syntax=docker/dockerfile:1.7
# 07-OPS-ARCH §10.2/10.3: multi-stage, non-root, no build tooling at runtime, ≤ 300 MB.
# Build context is the REPO ROOT (pnpm workspace: one pnpm-lock.yaml at the root):
#   docker build -f cms-api/Dockerfile .
FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN corepack enable
ENV HUSKY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY cms-api/package.json cms-api/
COPY cms-web/package.json cms-web/

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @cms/api
COPY cms-api/tsconfig.json cms-api/tsconfig.build.json cms-api/
COPY cms-api/prisma cms-api/prisma
COPY cms-api/src cms-api/src
RUN pnpm --dir cms-api prisma generate && pnpm --dir cms-api build

# Production dependencies only, hoisted into one flat /app/node_modules so the runtime keeps WORKDIR /app.
# `prisma` is a runtime dependency (dist/scripts/migrate.js runs `prisma migrate deploy`).
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @cms/api --config.node-linker=hoisted
COPY cms-api/prisma cms-api/prisma
RUN pnpm --dir cms-api exec prisma generate \
    && if [ -n "$(ls -A cms-api/node_modules 2>/dev/null | grep -v '^\.bin$')" ]; then \
         echo "cms-api/node_modules has unhoisted packages; the runtime only copies /app/node_modules" >&2; exit 1; \
       fi

FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends wget openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/false --create-home nodejs
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/cms-api/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/cms-api/prisma ./prisma
COPY --from=build --chown=nodejs:nodejs /app/cms-api/package.json ./
USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "dist/main.js"]
