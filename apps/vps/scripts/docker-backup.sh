#!/bin/bash

# Docker Backup Script
#
# This script builds and runs the backup in a Docker container with
# PostgreSQL client tools pre-installed.
#
# Usage:
#   ./scripts/docker-backup.sh
#
# Environment variables:
#   LOCAL_DB_URL - Database connection string
#
# Examples:
#   # Backup to local file
#   LOCAL_DB_URL=postgres://user:pass@host.docker.internal:5432/db ./scripts/docker-backup.sh
#
#   # Backup with SST resources (from host)
#   docker run --rm \
#     -v $(pwd)/backups:/app/backups \
#     -e PGHOST=host \
#     -e PGPORT=5432 \
#     -e PGUSER=user \
#     -e PGPASSWORD=pass \
#     -e PGDATABASE=db \
#     vps-backup bun run scripts/backup-db-local.ts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐳 Building Docker image for database backup...${NC}"

# Build the Docker image
docker build -f apps/vps/Dockerfile.backup -t gbfm-vps-backup .

echo -e "${GREEN}✓ Docker image built successfully${NC}\n"

# Check if LOCAL_DB_URL is set
if [ -z "$LOCAL_DB_URL" ]; then
    echo -e "${YELLOW}⚠️  LOCAL_DB_URL not set${NC}"
    echo -e "${YELLOW}   Using SST resources requires running within SST context${NC}"
    echo -e "${YELLOW}   Set LOCAL_DB_URL to backup a specific database${NC}\n"
    echo "Example:"
    echo "  LOCAL_DB_URL=postgres://user:pass@host.docker.internal:5432/db ./scripts/docker-backup.sh"
    exit 1
fi

echo -e "${GREEN}🔄 Running backup in Docker container...${NC}\n"

# Run the backup
docker run --rm \
    -v "$(pwd)/apps/vps/backups:/app/backups" \
    -e LOCAL_DB_URL="$LOCAL_DB_URL" \
    gbfm-vps-backup \
    bun run scripts/backup-db-local.ts

echo -e "\n${GREEN}✓ Backup complete!${NC}"
echo -e "${GREEN}📂 Backups are in: $(pwd)/apps/vps/backups/${NC}"
