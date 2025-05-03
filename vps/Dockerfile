FROM oven/bun AS base

WORKDIR /app

# Copy monorepo root files
COPY bun.lock ./
COPY package.json ./
COPY tsconfig.json ./

# Copy all workspace package manifests and tsconfigs for dependency resolution
COPY backend/package.json backend/tsconfig.json ./backend/
COPY core/package.json core/tsconfig.json ./core/
COPY web/package.json web/tsconfig.json ./web/
COPY vps/package.json vps/tsconfig.json ./vps/

# Copy all source code for dependency install (Bun needs sources for workspaces)
COPY backend ./backend
COPY core ./core
COPY web ./web
COPY vps ./vps

RUN bun install

# --- Development stage: hot reload, mount code as volume ---
FROM base AS dev

WORKDIR /app/vps
EXPOSE 3003
CMD ["bun", "run", "--hot", "src/api/index.ts"]

# --- Production stage: copy only built code, no hot reload ---
FROM base AS prod

WORKDIR /app/vps
EXPOSE 3003
CMD ["bun", "run", "src/api/index.ts"]