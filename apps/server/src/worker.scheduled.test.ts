import { expect, test } from 'vitest'
import {
  dispatchScheduledJob,
  maintenanceSweepCron,
  reminderSweepCron,
  sitemapRegenerationCron,
  type ScheduledJobs
} from './scheduled'

test('scheduled jobs dispatch only the job assigned to each cron', async () => {
  const hourlyJobs = createRecordingJobs()
  await dispatchScheduledJob(sitemapRegenerationCron, hourlyJobs)
  expect(hourlyJobs.sitemapRegenerations).toBe(1)
  expect(hourlyJobs.reminderSweeps).toBe(0)
  expect(hourlyJobs.maintenanceRuns).toBe(0)

  const minutelyJobs = createRecordingJobs()
  await dispatchScheduledJob(reminderSweepCron, minutelyJobs)
  expect(minutelyJobs.sitemapRegenerations).toBe(0)
  expect(minutelyJobs.reminderSweeps).toBe(1)
  expect(minutelyJobs.maintenanceRuns).toBe(0)

  const maintenanceJobs = createRecordingJobs()
  await dispatchScheduledJob(maintenanceSweepCron, maintenanceJobs)
  expect(maintenanceJobs.sitemapRegenerations).toBe(0)
  expect(maintenanceJobs.reminderSweeps).toBe(0)
  expect(maintenanceJobs.maintenanceRuns).toBe(1)
})

test('the maintenance cron does not collide with the hourly sitemap cron', () => {
  expect(maintenanceSweepCron).not.toBe(sitemapRegenerationCron)
})

const createRecordingJobs = () => {
  let sitemapRegenerations = 0
  let reminderSweeps = 0
  let maintenanceRuns = 0

  const jobs: ScheduledJobs = {
    regenerateSitemap: async () => {
      sitemapRegenerations += 1
    },
    sweepReminders: async () => {
      reminderSweeps += 1
    },
    runMaintenance: async () => {
      maintenanceRuns += 1
    }
  }

  return {
    ...jobs,
    get sitemapRegenerations() {
      return sitemapRegenerations
    },
    get reminderSweeps() {
      return reminderSweeps
    },
    get maintenanceRuns() {
      return maintenanceRuns
    }
  }
}
