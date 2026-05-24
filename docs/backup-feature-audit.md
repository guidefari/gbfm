# Database Backup Feature Audit

## Architecture

```
CronV2 (2 AM UTC daily)
  └── DatabaseBackupTask (ECS task / Lambda)
        └── invoke-backup-task.ts  →  backup-db.ts (handler)
              ├── pg_dump (binary on container)
              ├── S3 upload (DatabaseBackups bucket)
              └── sendBackupNotificationEmail → guidefari@icloud.com
```

## Key files

| Role | File |
|------|------|
| Infra: cron schedule | `infra/cron.ts` |
| Infra: task definition | `infra/vps.ts` (dbBackupTask) |
| Lambda invoker | `apps/cron/invoke-backup-task.ts` |
| Backup logic | `apps/vps/scripts/backup-db.ts` |
| Restore script | `apps/vps/scripts/restore-db.ts` |
| Shared utils | `apps/vps/scripts/backup-utils.ts` |
| Email template | `packages/email/emails/backup-notification.tsx` |
| Email sender fn | `packages/email/src/sender.ts` — `sendBackupNotificationEmail` |

## What works

- Daily pg_dump → S3 with metadata tags (timestamp, db, stage, method)
- Failure emails sent on: pg_dump not found, dump error, S3 upload error
- Success email with file/size details
- Log capture during run, included in email payload (not currently rendered in template)
- Restore script (`restore-db.ts`) downloads latest from S3, runs psql, cleans up temp file
- Restore prompts confirmation before destructive operation (can skip with `--skip-confirm`)
- Docker restore script at `apps/vps/scripts/docker-restore.sh`

## Gaps & issues

### 1. No backup retention / lifecycle policy
**Problem:** S3 bucket has no object lifecycle rules. Backups accumulate forever — cost grows unbounded.

**Fix:** Add S3 lifecycle rule to expire objects after N days (e.g. 30 days for daily backups = 30 max stored). Consider keeping weekly/monthly snapshots longer.

### 2. Hardcoded recipient email
**Problem:** `backup-db.ts:41` hardcodes `"guidefari@icloud.com"`. If ownership changes or multiple people need alerts, requires a code deploy.

**Fix:** Move to env var `BACKUP_ALERT_EMAIL` with the current address as fallback.

### 3. No backup verification / integrity check
**Problem:** Backup is considered successful if pg_dump exits 0 and S3 upload succeeds. The dump is never validated — a corrupt or empty dump would send a success email.

**Fix:** After dump, check `stdout.length > MIN_EXPECTED_BYTES` (e.g. 1 KB). Optionally test-restore to a throwaway schema.

### 4. No S3 encryption at rest configured explicitly
**Problem:** SST default S3 bucket may use SSE-S3. For a production database backup, SSE-KMS with a managed key is preferable for audit trails.

**Fix:** Add `encryption: { type: "KMS" }` to the bucket config in SST infra.

### 5. Restore script logs credentials to stdout
**Problem:** `restore-db.ts:343` logs `config.password` in plaintext: `Console.log(`📊 Password: ${config.password}`)`.

**Fix:** Remove that line.

### 6. Log content captured but not rendered in email
**Problem:** `backup-db.ts` captures all console output and passes `logContent` to the email sender, but `backup-notification.tsx` previously didn't render it. Current template also omits it.

**Fix:** Decide whether log content belongs in the email (verbose ops teams) or a separate S3 log artifact. If email: add a collapsible/truncated section. If artifact: upload logs to S3 alongside the backup file.

### 7. No alerting on missed backups
**Problem:** If the cron job itself fails to fire (ECS task scheduling issue, Lambda timeout on invoker), no notification is sent — the failure is silent.

**Fix:** Add a CloudWatch alarm on the cron's `InvocationsFailedToBeSentForExecution` metric, or implement a heartbeat check (e.g. daily check that a backup exists with today's date).

### 8. restore-db.ts `as any` usage
**Problem:** `restore-db.ts:106` uses `(Resource as any)` — bypasses type safety.

**Fix:** Same pattern as `backup-db.ts` which uses a typed helper `getResourceOrEnv`. Extract that helper to `backup-utils.ts` and share it.

## Restore runbook (current)

```bash
# From latest S3 backup → local DB
bun run scripts/restore-db.ts --source=s3 --destination=local

# From specific file → local DB
bun run scripts/restore-db.ts --source=./backups/backup-2026-05-24.sql --destination=local

# Skip confirmation prompt (CI/automation)
bun run scripts/restore-db.ts --source=s3 --destination=remote --skip-confirm
```

## Priority order for fixes

1. **Remove password log** (restore-db.ts:343) — security, trivial
2. **Hardcoded email** → env var — ops hygiene, trivial
3. **S3 retention policy** — cost, easy infra change
4. **Backup integrity check** — reliability, moderate
5. **Alerting on missed backups** — observability, moderate
6. **SSE-KMS encryption** — security compliance, infra change
7. **Share Resource helper** — code quality, low urgency
