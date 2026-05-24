FROM oven/bun:latest AS base
WORKDIR /usr/src/app

# --- Install dependencies (cached layer) ---
FROM base AS deps

COPY bun.lock ./
COPY package.json ./
COPY apps/vps/package.json ./apps/vps/
COPY packages/email/package.json ./packages/email/
COPY packages/core/package.json ./packages/core/
COPY packages/theme/package.json ./packages/theme/

RUN bun install --omit dev --ignore-scripts

COPY packages/email/src ./packages/email/src
COPY packages/email/emails ./packages/email/emails
COPY packages/core/src ./packages/core/src
COPY packages/theme/src ./packages/theme/src
COPY packages/theme/styles ./packages/theme/styles
COPY apps/vps/src ./apps/vps/src
COPY apps/vps/scripts ./apps/vps/scripts
COPY apps/vps/package.json apps/vps/tsconfig.json ./apps/vps/
COPY packages/email/package.json packages/email/tsconfig.json ./packages/email/
COPY packages/core/package.json packages/core/tsconfig.json ./packages/core/
COPY packages/theme/package.json packages/theme/tsconfig.json ./packages/theme/
COPY tsconfig.json ./

# --- Shared production base ---
FROM base AS prod-base
WORKDIR /usr/src/app

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package.json ./package.json
COPY --from=deps /usr/src/app/packages/email ./packages/email
COPY --from=deps /usr/src/app/packages/core ./packages/core
COPY --from=deps /usr/src/app/packages/theme ./packages/theme
COPY --from=deps /usr/src/app/apps/vps ./apps/vps
COPY --from=deps /usr/src/app/tsconfig.json ./tsconfig.json

# --- API server ---
FROM prod-base AS release

EXPOSE 3003
WORKDIR /usr/src/app/apps/vps

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:3003/health || exit 1

CMD ["bun", "--preload", "./src/instrument.ts", "src/index.ts"]

# --- Database backup task ---
FROM oven/bun:alpine AS backup-task
RUN apk add --no-cache postgresql-client
WORKDIR /usr/src/app

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package.json ./package.json
COPY --from=deps /usr/src/app/packages/email ./packages/email
COPY --from=deps /usr/src/app/packages/core ./packages/core
COPY --from=deps /usr/src/app/packages/theme ./packages/theme
COPY --from=deps /usr/src/app/apps/vps ./apps/vps
COPY --from=deps /usr/src/app/tsconfig.json ./tsconfig.json

CMD ["bun", "run", "apps/vps/scripts/run-backup-task.ts"]
