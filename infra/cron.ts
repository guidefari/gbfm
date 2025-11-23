// import { dbBackupBucket } from './bucket'
// import { allSecrets } from './secret'
import { dbBackupTask } from './vps'

/**
 * Daily Database Backup Cron Job
 *
 * Runs at 2:00 AM UTC every day to create database backups
 * and upload them to S3.
 *
 * Uses a Task with a Docker container that has PostgreSQL client tools and Bun installed.
 */

export const dbBackupCron = new sst.aws.Cron('DatabaseBackupCron', {
  job: {
    handler: 'apps/vps/scripts/invoke-backup-task.handler',
    link: [dbBackupTask],
    timeout: '2 minutes'
  },
  // Run daily at 2:00 AM UTC
  schedule: 'cron(0 2 * * ? *)'
  // schedule: "rate(1 minute)"
})

export const testFunction = new sst.aws.Function('BackupTaskInvoker', {
  handler: 'apps/vps/scripts/invoke-backup-task.handler',
  dev: false,
  url: true,
  link: [dbBackupTask],
  timeout: '2 minutes'
})

export const outputs = {
  dbBackupCron: dbBackupCron.nodes.function.name,
  testFunction: testFunction.url
}
