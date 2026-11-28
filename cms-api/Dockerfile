# syntax=docker/dockerfile:1.7
# 07-OPS-ARCH §10.2/10.3: multi-stage, non-root, no build tooling at runtime, ≤ 300 MB.
# Build context is the REPO ROOT (pnpm workspace: one pnpm-lock.yaml at the root):
#   docker build -f cms-api/Dockerfile .
FROM node:26-bookworm-slim AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# The root `prepare` script installs git hooks (husky, a root devDependency): meaningless in an image and
# absent from a --prod install, where it would fail the build.
RUN npm pkg delete scripts.prepare
COPY cms-api/package.json cms-api/
COPY cms-web/package.json cms-web/

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @cms/api
COPY cms-api/tsconfig.json cms-api/tsconfig.build.json cms-api/
COPY cms-api/prisma cms-api/prisma
COPY cms-api/src cms-api/src
RUN pnpm --dir cms-api prisma:generate && pnpm --dir cms-api build

# Production dependencies only. `prisma` is a runtime dependency: dist/scripts/migrate.js runs
# `prisma migrate deploy`. Hoisted = real directories, no symlinks into a virtual store.
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @cms/api --config.node-linker=hoisted
COPY cms-api/prisma cms-api/prisma
RUN pnpm --dir cms-api prisma:generate && mkdir -p cms-api/node_modules

FROM node:26-bookworm-slim AS runtime
# - apt-get upgrade: take Debian security fixes newer than the base image (Trivy gate, 05-METRICS G-05).
# - No package managers at runtime (07-OPS-ARCH §10.2): the image's bundled npm/corepack/yarn carry their own
#   vulnerable dependencies and are unused — migrations run the installed prisma CLI with node (migrate-command.ts).
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends wget openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v* \
              /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    && groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/false --create-home nodejs
# Same layout as the workspace: most packages are hoisted to /app/node_modules, but a few versions conflict
# and stay in /app/cms-api/node_modules, which Node must resolve first.
WORKDIR /app/cms-api
ENV NODE_ENV=production
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=nodejs:nodejs /app/cms-api/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/cms-api/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/cms-api/prisma ./prisma
COPY --from=build --chown=nodejs:nodejs /app/cms-api/package.json ./
USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "dist/main.js"]
