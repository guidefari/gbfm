FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# --- Install dev dependencies for build/test ---
FROM base AS install
RUN bun add -g pnpm
RUN mkdir -p /temp/dev

# Copy monorepo root files and all workspace manifests for dependency resolution
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json /temp/dev/
COPY packages/core/package.json packages/core/tsconfig.json /temp/dev/packages/core/
COPY apps/www/package.json apps/www/tsconfig.json /temp/dev/apps/www/
COPY apps/vps/package.json apps/vps/tsconfig.json /temp/dev/apps/vps/

# Copy all source code for workspace-aware install
COPY packages/core /temp/dev/packages/core
COPY apps/www /temp/dev/apps/www
COPY apps/vps /temp/dev/apps/vps

WORKDIR /temp/dev
RUN pnpm install --frozen-lockfile

# --- Install only production dependencies ---
RUN mkdir -p /temp/prod
COPY pnpm-lock.yaml package.json tsconfig.json /temp/prod/
COPY packages/core/package.json packages/core/tsconfig.json /temp/prod/packages/core/
COPY apps/www/package.json apps/www/tsconfig.json /temp/prod/apps/www/
COPY apps/vps/package.json apps/vps/tsconfig.json /temp/prod/apps/vps/
WORKDIR /temp/prod
RUN pnpm install --frozen-lockfile --production

# --- Final production image: only prod deps and all source code ---
FROM base AS release
WORKDIR /usr/src/

# Copy production node_modules
COPY --from=install /temp/prod/node_modules node_modules

# Copy all source code and minimal package files
COPY apps/vps ./apps/vps
COPY packages/core ./packages/core
COPY apps/www ./apps/www
COPY package.json .
COPY pnpm-lock.yaml .
COPY tsconfig.json .

USER bun
WORKDIR /usr/src/apps/vps
EXPOSE 3003
ENTRYPOINT [ "bun", "run", "src/apps/vps/src/index.ts" ]
