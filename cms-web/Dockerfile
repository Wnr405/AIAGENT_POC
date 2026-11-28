# syntax=docker/dockerfile:1.7
# Builds the static SPA. 07-OPS-ARCH §4.1 option (B): the dist/ output is copied
# into the nginx container (cms-infra/web-dist) — this image is only a build stage.
# Build context is the REPO ROOT (pnpm workspace: one pnpm-lock.yaml at the root):
#   docker build -f cms-web/Dockerfile --target dist .
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
ENV HUSKY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY cms-api/package.json cms-api/
COPY cms-web/package.json cms-web/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @cms/web
COPY cms-web/ cms-web/
ARG VITE_PUBLIC_API_URL=/api
WORKDIR /app/cms-web
RUN pnpm build && node scripts/check-bundle-size.mjs

FROM scratch AS dist
COPY --from=build /app/cms-web/dist /
