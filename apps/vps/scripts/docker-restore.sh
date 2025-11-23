#!/bin/bash

# Docker Restore Script
#
# This script builds and runs the database restore in a Docker container
# with PostgreSQL client tools pre-installed.
#
# Usage:
#   ./scripts/docker-restore.sh <backup-file>
#
# Environment variables:
#   LOCAL_DB_URL - Database connection string
#   SKIP_CONFIRM - Skip confirmation prompt (1 to skip)
#
# Examples:
#   # Restore from backup file
#   LOCAL_DB_URL=postgres://user:pass@host.docker.internal:5432/db \
#     ./scripts/docker-restore.sh backups/backup-2025-11-14.sql
#
#   # Restore without confirmation
#   SKIP_CONFIRM=1 LOCAL_DB_URL=postgres://user:pass@localhost:5432/db \
#     ./scripts/docker-restore.sh backup.sql

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: No backup file specified${NC}"
    echo ""
    echo "Usage:"
    echo "  ./scripts/docker-restore.sh <backup-file>"
    echo ""
    echo "Example:"
    echo "  LOCAL_DB_URL=postgres://user:pass@host.docker.internal:5432/db \\"
    echo "    ./scripts/docker-restore.sh backups/backup-2025-11-14.sql"
    exit 1
fi

BACKUP_FILE="$1"

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}🐳 Building Docker image for database restore...${NC}"

# Build the Docker image
docker build -f apps/vps/Dockerfile.backup -t gbfm-vps-backup .

echo -e "${GREEN}✓ Docker image built successfully${NC}\n"

# Check if LOCAL_DB_URL is set
if [ -z "$LOCAL_DB_URL" ]; then
    echo -e "${YELLOW}⚠️  LOCAL_DB_URL not set${NC}"
    echo -e "${YELLOW}   Using SST resources requires running within SST context${NC}"
    echo -e "${YELLOW}   Set LOCAL_DB_URL to restore to a specific database${NC}\n"
    echo "Example:"
    echo "  LOCAL_DB_URL=postgres://user:pass@host.docker.internal:5432/db \\"
    echo "    ./scripts/docker-restore.sh $BACKUP_FILE"
    exit 1
fi

# Get absolute path of backup file
BACKUP_FILE_ABS=$(realpath "$BACKUP_FILE")
BACKUP_FILE_NAME=$(basename "$BACKUP_FILE")

echo -e "${GREEN}🔄 Running restore in Docker container...${NC}"
echo -e "${YELLOW}📁 Backup file: $BACKUP_FILE_ABS${NC}\n"

# Run the restore
docker run --rm -i \
    -v "$BACKUP_FILE_ABS:/app/backup.sql:ro" \
    -e LOCAL_DB_URL="$LOCAL_DB_URL" \
    -e SKIP_CONFIRM="${SKIP_CONFIRM:-0}" \
    gbfm-vps-backup \
    bun run scripts/restore-db.ts /app/backup.sql

echo -e "\n${GREEN}✓ Restore complete!${NC}"
