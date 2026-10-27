# Build on Linux so native modules match the runtime. Do not copy a workstation node_modules tree.

FROM node:24.16.0-bookworm-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24.16.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/dist/worker ./dist/worker
# pnpm does not hoist sharp, argon2, or pg's transitive packages.
# The full store keeps the standalone server and the external worker runnable.
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "server.js"]
