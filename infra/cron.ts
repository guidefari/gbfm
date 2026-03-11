import { dbBackupTask } from './vps'

/**
 * Daily Database Backup Cron Job
 *
 * Runs at 2:00 AM UTC every day to create database backups
 * and upload them to S3.
 *
 * Uses a Task with a Docker container that has PostgreSQL client tools and Bun installed.
 */

export const dbBackupCron = new sst.aws.CronV2('DatabaseBackupCron', {
  task: dbBackupTask,
  schedule: 'cron(0 2 * * ? *)'
})

export const testFunction = new sst.aws.Function('BackupTaskInvoker', {
  handler: 'apps/cron/invoke-backup-task.handler',
  dev: false,
  url: true,
  link: [dbBackupTask],
  timeout: '2 minutes'
})

export const outputs = {
  testFunction: testFunction.url
}
