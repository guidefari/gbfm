# Database Backup System

This document describes the comprehensive database backup system implemented for the GBFM VPS application.

## Overview

The backup system provides multiple methods for backing up and restoring the PostgreSQL database:
- **Automated daily backups** to S3 via AWS Lambda cron job
- **Manual S3 backups** for production and development
- **Local filesystem backups** for development and testing
- **Database restore** from SQL dump files
- **Automatic fallback** when `pg_dump`/`psql` are not available

All backups are created using PostgreSQL's `pg_dump` when available, with a pure Node.js fallback for environments without PostgreSQL client tools. Restores use `psql` when available, with a fallback to pure Node.js execution.

## Architecture

### Components

1. **S3 Backup Bucket** (`infra/bucket.ts`)
   - Private S3 bucket: `DatabaseBackups`
   - Not exposed via any API routes
   - Linked to VPS service for backup operations

2. **Cron Job** (`infra/cron.ts`)
   - Runs daily at 2:00 AM UTC
   - Uses Lambda function with 15-minute timeout and 1GB memory
   - Automatically uploads backups to S3

3. **Backup & Restore Scripts** (`apps/vps/scripts/`)
   - `backup-db.ts` - S3 backup script (manual or Lambda)
   - `backup-db-local.ts` - Local filesystem backup script
   - `backup-db-lambda.ts` - Lambda-specific backup handler
   - `restore-db.ts` - Database restore script
   - `backup-utils.ts` - Shared utilities and fallback logic

### Backup Methods

#### Method 1: pg_dump (Recommended)
- Uses PostgreSQL's native `pg_dump` utility
- Produces high-quality, comprehensive SQL dumps
- Includes schema, data, constraints, and indexes
- Automatically selected when `pg_dump` is available

#### Method 2: Pure Node.js (Fallback)
- Uses the `pg` library directly
- Works in environments without PostgreSQL client tools
- Automatically selected when `pg_dump` is not found
- Generates valid SQL dumps from database schema and data

## Files Created/Modified

### New Files
```
apps/vps/scripts/backup-db.ts          # S3 backup script
apps/vps/scripts/backup-db-local.ts    # Local backup script
apps/vps/scripts/backup-db-lambda.ts   # Lambda handler
apps/vps/scripts/restore-db.ts         # Database restore script
apps/vps/scripts/backup-utils.ts       # Shared utilities
infra/cron.ts                          # Daily backup cron job
```

### Modified Files
```
infra/bucket.ts           # Added DatabaseBackups bucket
infra/vps.ts              # Linked backup bucket to VPS service
infra/dev.script.ts       # Added Backup_Database dev command
apps/vps/package.json     # Added backup npm scripts
apps/vps/.gitignore       # Ignored backups/ directory
```

## Usage

### Local Filesystem Backup

Save a backup to the local `backups/` directory:

```bash
# Using SST resources (default)
bun db:backup:local

# Using custom database URL
LOCAL_DB_URL=postgres://user:password@localhost:5432/mydb bun db:backup:local
```

**Output:**
```
🔄 Starting local database backup...
🔗 Using LOCAL_DB_URL connection string
📊 Database: mydb
   Host: localhost:5432
✓ Using pg_dump (recommended)
📦 Creating database dump using pg_dump...
✅ Database dump created (2.45 MB)
📂 Location: /path/to/backups/backup-2025-11-14T12-30-00-000Z.sql
📦 Size: 2.45 MB
🎉 Local backup complete!
```

### S3 Backup (Development)

Upload a backup to S3:

```bash
# Using SST resources
bun db:backup

# Using custom database URL
LOCAL_DB_URL=postgres://user:password@localhost:5432/mydb bun db:backup
```

### S3 Backup (Production)

```bash
bun db:backup:prod
```

### Using SST Dev Command

Within `sst dev`:

```bash
# Start the backup process
sst dev Backup_Database
```

### Database Restore

Restore a database from a SQL dump file:

```bash
# Restore to SST database (will prompt for confirmation)
bun db:restore backups/backup-2025-11-14T12-30-00-000Z.sql

# Restore to local database
LOCAL_DB_URL=postgres://user:password@localhost:5432/mydb bun db:restore backup.sql

# Skip confirmation prompt (automated scripts)
SKIP_CONFIRM=1 bun db:restore backup.sql
```

**⚠️ Important Warning:**
- Restore operations are **DESTRUCTIVE**
- All existing tables will be dropped
- All current data will be deleted
- Always backup your current database before restoring
- You will be prompted for confirmation unless `SKIP_CONFIRM=1` is set

**Output:**
```
🔄 Starting database restore...
📁 Backup file: /path/to/backups/backup-2025-11-14T12-30-00-000Z.sql
📦 File size: 2.45 MB
🔗 Using LOCAL_DB_URL connection string

⚠️  WARNING: DESTRUCTIVE OPERATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This will restore from: /path/to/backup.sql
Target database: mydb
Host: localhost:5432
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This operation will:
  • DROP existing tables
  • DELETE all current data
  • REPLACE with backup data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type 'yes' to continue: yes

🚀 Starting restore operation...
✓ Using psql (recommended)
📦 Restoring database using psql...
✅ Database restored successfully using psql

🎉 Database restore complete!
📊 Database: mydb
   Host: localhost:5432
```

## Environment Variables

### LOCAL_DB_URL (Optional)

Override the database connection for backup and restore operations:

```bash
# Format
LOCAL_DB_URL=postgres://[user]:[password]@[host]:[port]/[database]

# Example
LOCAL_DB_URL=postgres://admin:secret123@localhost:5432/myapp
```

**When to use:**
- Testing backups/restores against a local database
- Backing up or restoring a development database
- Working without SST resources configured

**Default behavior:**
- Uses SST Resource values when `LOCAL_DB_URL` is not set
- Automatically pulls credentials from SST infrastructure

### SKIP_CONFIRM (Optional)

Skip the confirmation prompt for restore operations:

```bash
# Skip confirmation (use with caution!)
SKIP_CONFIRM=1 bun db:restore backup.sql
```

**When to use:**
- Automated scripts
- CI/CD pipelines
- Non-interactive environments

**⚠️ Warning:** Only use this in trusted environments where you're certain about the restore operation

## Automated Backups

### Cron Schedule

The automated backup cron job runs:
- **Frequency:** Daily
- **Time:** 2:00 AM UTC
- **Method:** AWS Lambda function
- **Storage:** S3 bucket (DatabaseBackups)

### Configuration

The cron job is configured in `infra/cron.ts`:

```typescript
export const dbBackupCron = new sst.aws.Cron('DatabaseBackupCron', {
  job: {
    handler: 'apps/vps/scripts/backup-db-lambda.handler',
    nodejs: {
      install: ['pg'],
    },
    timeout: '15 minutes',
    memory: '1024 MB',
    link: [dbBackupBucket, ...allSecrets],
  },
  schedule: 'cron(0 2 * * ? *)',
})
```

### Backup Metadata

Each S3 backup includes metadata:
- `timestamp` - ISO timestamp of backup creation
- `database` - Database name
- `stage` - SST stage (dev/prod)
- `method` - Backup method used (pg_dump or pg-library)

## Fallback Behavior

### When pg_dump is Not Available

If `pg_dump` is not installed, the system automatically:

1. Detects the missing `pg_dump` command
2. Displays installation instructions
3. Falls back to pure Node.js backup method
4. Continues with the backup operation

**Example output:**
```
⚠️  pg_dump not found, using pure Node.js backup
   Install PostgreSQL client tools for better backup quality:
   - macOS: brew install postgresql
   - Ubuntu/Debian: sudo apt-get install postgresql-client
   - Windows: Download from postgresql.org
```

### Installing pg_dump

For better backup quality, install PostgreSQL client tools:

**macOS:**
```bash
brew install postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-client
```

**Windows:**
- Download from [postgresql.org](https://www.postgresql.org/download/windows/)

## Backup File Format

### Filename Convention

```
backup-[ISO_TIMESTAMP].sql
```

Example: `backup-2025-11-14T12-30-00-000Z.sql`

### File Contents

SQL dump files include:
- `DROP TABLE` statements (with `IF EXISTS`)
- `CREATE TABLE` statements
- `INSERT` statements with all data
- Proper escaping for special characters
- Transaction-safe operations

### Sample Backup File

```sql
-- Database Backup
-- Generated: 2025-11-14T12:30:00.000Z
-- Database: mydb
-- Method: pg_dump

DROP TABLE IF EXISTS "users" CASCADE;
CREATE TABLE "users" (
  "id" serial PRIMARY KEY,
  "email" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now()
);

-- Data for users (150 rows)
INSERT INTO "users" (id, email, created_at) VALUES (1, 'user@example.com', '2025-01-01T00:00:00.000Z');
...
```

## Storage Locations

### S3 Bucket
- **Bucket Name:** `DatabaseBackups` (managed by SST)
- **Access:** Private (not exposed via router)
- **Region:** Same as SST deployment region
- **Retention:** Managed by AWS S3 lifecycle policies (if configured)

### Local Filesystem
- **Directory:** `apps/vps/backups/`
- **Ignored:** Yes (in `.gitignore`)
- **Cleanup:** Manual (backups are not auto-deleted)

## Security Considerations

### S3 Bucket Security
- ✅ Private access only
- ✅ Not exposed via API routes
- ✅ IAM permissions required
- ✅ Encryption at rest (AWS default)

### Database Credentials
- ✅ Stored in SST secrets
- ✅ Never logged in plain text
- ✅ Passed via environment variables
- ✅ Not included in backup files

### Local Backups
- ⚠️ Stored in plain text SQL files
- ⚠️ Contains database data
- ⚠️ Ensure proper file permissions
- ✅ Automatically ignored by git

## Troubleshooting

### Error: pg_dump command not found

**Solution:** The system will automatically fall back to pure Node.js backup. For better quality, install PostgreSQL client tools (see "Installing pg_dump" above).

### Error: Permission denied on S3 bucket

**Cause:** Missing IAM permissions for S3 operations.

**Solution:** Ensure the Lambda function or service has proper IAM permissions to write to the S3 bucket.

### Error: Connection timeout

**Cause:** Database host unreachable or SSL misconfiguration.

**Solution:**
- Verify database host and port
- Check SSL settings in `drizzle.config.ts`
- Ensure network connectivity

### Large backup files

**Recommendation:**
- Use `pg_dump` for better compression
- Consider implementing compression before S3 upload
- Configure S3 lifecycle policies to archive old backups

## Future Enhancements

Potential improvements for the backup system:

- [ ] Automatic backup rotation (delete old backups)
- [ ] Compression (gzip) before S3 upload
- [ ] Backup verification and restore testing
- [ ] Slack/Email notifications on backup success/failure
- [ ] Incremental backups for large databases
- [ ] Multi-region S3 replication
- [ ] Point-in-time recovery support
- [ ] Backup encryption before upload

## Related Resources

- [PostgreSQL pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [SST Cron Documentation](https://sst.dev/docs/component/aws/cron)
- [AWS S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/best-practices.html)

## Support

For issues or questions about the backup system:
1. Check the troubleshooting section above
2. Review backup script logs
3. Verify SST resource configuration
4. Check AWS CloudWatch logs for Lambda function

---

**Last Updated:** 2025-11-14
**Version:** 1.0.0
