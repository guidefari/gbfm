FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# --- Install dev dependencies for build/test ---
FROM base AS install
RUN mkdir -p /temp/dev

# Copy monorepo root files and all workspace manifests for dependency resolution
COPY bun.lock package.json tsconfig.json /temp/dev/
COPY backend/package.json backend/tsconfig.json /temp/dev/backend/
COPY core/package.json core/tsconfig.json /temp/dev/core/
COPY web/package.json web/tsconfig.json /temp/dev/web/
COPY vps/package.json vps/tsconfig.json /temp/dev/vps/

# Copy all source code for workspace-aware install
COPY backend /temp/dev/backend
COPY core /temp/dev/core
COPY web /temp/dev/web
COPY vps /temp/dev/vps

WORKDIR /temp/dev
RUN bun install --frozen-lockfile

# --- Install only production dependencies ---
RUN mkdir -p /temp/prod
COPY bun.lock package.json tsconfig.json /temp/prod/
COPY backend/package.json backend/tsconfig.json /temp/prod/backend/
COPY core/package.json core/tsconfig.json /temp/prod/core/
COPY web/package.json web/tsconfig.json /temp/prod/web/
COPY vps/package.json vps/tsconfig.json /temp/prod/vps/
WORKDIR /temp/prod
RUN bun install --frozen-lockfile --production

# --- Final production image: only prod deps and all source code ---
FROM base AS release
WORKDIR /usr/src/app

# Copy production node_modules
COPY --from=install /temp/prod/node_modules node_modules

# Copy all source code and minimal package files
COPY vps ./vps
COPY backend ./backend
COPY core ./core
COPY web ./web
COPY package.json .
COPY bun.lock .
COPY tsconfig.json .

USER bun
WORKDIR /usr/src/app/vps
EXPOSE 3003
ENTRYPOINT [ "bun", "run", "src/api/index.ts" ]


# simpler dockerfile 

# FROM oven/bun AS base

# WORKDIR /app

# # Copy monorepo root files
# COPY bun.lock ./
# COPY package.json ./
# COPY tsconfig.json ./

# # Copy all workspace package manifests and tsconfigs for dependency resolution
# COPY backend/package.json backend/tsconfig.json ./backend/
# COPY core/package.json core/tsconfig.json ./core/
# COPY web/package.json web/tsconfig.json ./web/
# COPY vps/package.json vps/tsconfig.json ./vps/

# # Copy all source code for dependency install (Bun needs sources for workspaces)
# COPY backend ./backend
# COPY core ./core
# COPY web ./web
# COPY vps ./vps

# RUN bun install

# # --- Development stage: hot reload, mount code as volume ---
# FROM base AS dev

# WORKDIR /app/vps
# EXPOSE 3003
# CMD ["bun", "run", "--hot", "src/api/index.ts"]

# # --- Production stage: copy only built code, no hot reload ---
# FROM base AS release

# WORKDIR /app/vps
# EXPOSE 3003
# CMD ["bun", "run", "src/api/index.ts"]