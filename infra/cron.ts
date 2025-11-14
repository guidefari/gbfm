import { dbBackupBucket } from './bucket'
import { allSecrets } from './secret'

/**
 * Daily Database Backup Cron Job
 *
 * Runs at 2:00 AM UTC every day to create database backups
 * and upload them to S3.
 *
 * Uses a container image with PostgreSQL client tools installed.
 */
export const dbBackupCron = new sst.aws.Cron('DatabaseBackupCron', {
  job: {
    handler: 'apps/vps/scripts/backup-db-lambda.handler',
    nodejs: {
      install: ['pg']
    },
    timeout: '15 minutes',
    memory: '1024 MB',
    link: [dbBackupBucket, ...allSecrets]
  },
  // Run daily at 2:00 AM UTC
  schedule: 'cron(0 2 * * ? *)'
})

export const outputs = {
  dbBackupCron: dbBackupCron.nodes.function.name
}
