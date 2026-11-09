# syntax=docker/dockerfile:1.7
# Builds the static SPA. 07-OPS-ARCH §4.1 option (B): the dist/ output is copied
# into the nginx container (cms-infra/web-dist) — this image is only a build stage.
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
ARG VITE_PUBLIC_API_URL=/api
RUN pnpm build && node scripts/check-bundle-size.mjs

FROM scratch AS dist
COPY --from=build /app/dist /
