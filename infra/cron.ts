import { scheduledMaintenanceTask } from './vps'

export const blueskySyncCron = new sst.aws.CronV2('BlueskySyncCron', {
  task: scheduledMaintenanceTask,
  schedule: 'rate(1 hour)',
  retries: 0
})
