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

# Copy the entire workspace structure with node_modules
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package.json ./package.json
COPY --from=deps /usr/src/app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /usr/src/app/tsconfig.json ./tsconfig.json

# Copy the packages and apps
COPY packages/core ./packages/core
COPY apps/vps ./apps/vps

USER bun
EXPOSE 3003
# Run from workspace root using bun to execute the VPS app directly
WORKDIR /usr/src
ENTRYPOINT [ "bun", "apps/vps/src/index.ts" ]
