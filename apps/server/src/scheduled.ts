export const reminderSweepCron = '* * * * *'
export const sitemapRegenerationCron = '0 * * * *'

export interface ScheduledJobs {
  readonly regenerateSitemap: () => Promise<void>
  readonly sweepReminders: () => Promise<void>
}

export const dispatchScheduledJob = (cron: string, jobs: ScheduledJobs): Promise<void> => {
  if (cron === sitemapRegenerationCron) {
    return jobs.regenerateSitemap()
  }
  if (cron === reminderSweepCron) {
    return jobs.sweepReminders()
  }
  return Promise.resolve()
}
