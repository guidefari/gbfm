FROM oven/bun:latest AS base
WORKDIR /usr/src/app

# --- Install dependencies (cached layer) ---
FROM base AS deps

# Copy lockfile and package.json files first for better caching
COPY bun.lock ./
COPY package.json ./
COPY apps/vps/package.json ./apps/vps/
COPY packages/email/package.json ./packages/email/

# Install dependencies with retry and cache clearing
RUN bun install --omit dev --ignore-scripts

# Copy source code after dependencies are installed (exclude node_modules)
COPY packages/email/src ./packages/email/src
COPY packages/email/emails ./packages/email/emails
COPY apps/vps/src ./apps/vps/src
COPY apps/vps/package.json apps/vps/tsconfig.json ./apps/vps/
COPY packages/email/package.json packages/email/tsconfig.json ./packages/email/
COPY tsconfig.json ./

# --- Production stage ---
FROM base AS release
WORKDIR /usr/src/app

# Copy the installed dependencies
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package.json ./package.json

# Copy source code
COPY --from=deps /usr/src/app/packages/email ./packages/email
COPY --from=deps /usr/src/app/apps/vps ./apps/vps
COPY --from=deps /usr/src/app/tsconfig.json ./tsconfig.json

EXPOSE 3003
WORKDIR /usr/src/app/apps/vps

# Health check to monitor application status
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

CMD ["bun", "run", "src/index.ts"]