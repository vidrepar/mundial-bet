# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

# --- deps (compiles better-sqlite3 native binding) ---
FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- runner (slim, standalone) ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=/app/data/mundial.db
RUN mkdir -p /app/data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
EXPOSE 3000
VOLUME ["/app/data"]
# instrumentation.ts migrates + seeds on first boot
CMD ["node", "server.js"]
