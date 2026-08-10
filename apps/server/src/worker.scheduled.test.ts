import { describe, expect, test } from 'vitest'
import {
  dispatchScheduledJob,
  reminderSweepCron,
  sitemapRegenerationCron,
  type ScheduledJobs
} from './scheduled'

describe('worker scheduled handler', () => {
  test('regenerates the sitemap only on the hourly cron', async () => {
    const jobs = createRecordingJobs()

    await dispatchScheduledJob(sitemapRegenerationCron, jobs)

    expect(jobs.sitemapRegenerations).toBe(1)
    expect(jobs.reminderSweeps).toBe(0)
  })

  test('sweeps reminders only on the per-minute cron', async () => {
    const jobs = createRecordingJobs()

    await dispatchScheduledJob(reminderSweepCron, jobs)

    expect(jobs.sitemapRegenerations).toBe(0)
    expect(jobs.reminderSweeps).toBe(1)
  })
})

const createRecordingJobs = () => {
  let sitemapRegenerations = 0
  let reminderSweeps = 0

  const jobs: ScheduledJobs = {
    regenerateSitemap: async () => {
      sitemapRegenerations += 1
    },
    sweepReminders: async () => {
      reminderSweeps += 1
    }
  }

  return {
    ...jobs,
    get sitemapRegenerations() {
      return sitemapRegenerations
    },
    get reminderSweeps() {
      return reminderSweeps
    }
  }
}
