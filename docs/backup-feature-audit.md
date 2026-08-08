# Database backup retirement

## Decision

The repository-owned PostgreSQL dump subsystem was retired on 2026-08-08. Database backup and restore operations now belong in PlanetScale rather than an SST cron, ECS task, and S3 bucket.

Decision evidence: [`migrations/evidence/planetscale-backup-decision-2026-08-08.md`](migrations/evidence/planetscale-backup-decision-2026-08-08.md).

## Removed surface

- daily `DatabaseBackupCron` and `DatabaseBackupTask`;
- manual `BackupTaskInvoker` Lambda;
- backup, verification, and restore scripts;
- backup-specific Docker image stage and development commands;
- backup notification email and sender;
- backup bucket/task application config.

The old `DatabaseBackups` S3 bucket is not linked to any compute and is not part of the R2 migration. Its infrastructure declaration remains temporarily so the existing 30-day lifecycle can age out recovery data. Remove the declaration only after the bucket is confirmed empty.

## Operational ownership

PlanetScale owns the active backup path. The operator must manage backup cadence, retention, restore access, and restore exercises there. These settings and credentials do not belong in this repository.

No repository command now creates or restores a production database backup.
