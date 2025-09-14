#!/bin/bash

# PostgreSQL Backup Script
set -e

DB_NAME="${DB_NAME:-myapp}"
DB_USER="${DB_USER:-appuser}"
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/postgres_backup_${DATE}.sql.gz"

echo "Starting backup of database: $DB_NAME"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create the backup
pg_dump -h postgres -U $DB_USER -d $DB_NAME | gzip > $BACKUP_FILE

echo "Backup completed: $BACKUP_FILE"

# Clean up old backups (keep last 7 days)
find $BACKUP_DIR -name "postgres_backup_*.sql.gz" -mtime +7 -delete

echo "Old backups cleaned up"
