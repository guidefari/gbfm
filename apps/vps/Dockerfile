FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# --- Install dependencies (cached layer) ---
FROM base AS deps

# Copy monorepo root files and all workspace manifests for dependency resolution
COPY package.json tsconfig.json ./
COPY packages/core/package.json packages/core/tsconfig.json ./packages/core/
COPY apps/vps/package.json apps/vps/tsconfig.json ./apps/vps/

# Copy all source code for workspace-aware install (Bun needs sources for workspaces)
COPY packages/core ./packages/core
COPY apps/vps ./apps/vps

# Install dependencies using Bun (allow lockfile updates for workspace compatibility)
RUN bun install --frozen-lockfile --production

# --- Production stage ---
FROM base AS release
WORKDIR /usr/src/app

# Copy the entire workspace structure with node_modules
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package.json ./package.json
COPY --from=deps /usr/src/app/bun.lock ./bun.lock
COPY --from=deps /usr/src/app/tsconfig.json ./tsconfig.json

# Copy the packages and apps
COPY packages/core ./packages/core
COPY apps/vps ./apps/vps

USER bun
EXPOSE 3003
# Run from the VPS app directory directly
WORKDIR /usr/src/app/apps/vps
ENTRYPOINT [ "bun", "run", "src/index.ts" ]
