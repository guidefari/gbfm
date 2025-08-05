FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# --- Install dependencies (cached layer) ---
FROM base AS deps
RUN bun add -g pnpm

# Copy only the required package files for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/vps/package.json ./apps/vps/

# Install dependencies (this layer will be cached unless package files change)
RUN pnpm install --frozen-lockfile

# --- Build stage ---
FROM deps AS build
# Copy only the required source code
COPY packages/core ./packages/core
COPY apps/vps ./apps/vps

# --- Production stage ---
FROM base AS release
WORKDIR /usr/src

# Copy only production dependencies
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy only the required source code and config files
COPY packages/core ./packages/core
COPY apps/vps ./apps/vps
COPY package.json pnpm-lock.yaml tsconfig.json ./

USER bun
EXPOSE 3003
# Change working directory to apps/vps and run from there
WORKDIR /usr/src/apps/vps
ENTRYPOINT [ "bun", "run", "src/index.ts" ]
