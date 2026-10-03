import type { AdminTelemetryResponse } from '@gbfm/api/admin'
import { expect, test } from '@playwright/test'

test.use({ deviceScaleFactor: 2 })

test('telemetry distinguishes unavailable queries, empty data, percentile units, and request failures', async ({
  page,
}) => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/frontend-errors')
  const payload: AdminTelemetryResponse = {
    generatedAt: '2026-09-27T10:00:00.000Z',
    windowHours: 24,
    state: 'partial',
    retentionNotice: 'Sampled aggregates only.',
    sections: {
      webVitals: {
        available: true,
        rows: [
          {
            name: 'CLS',
            route: '/shows/:slug',
            release: 'release-test',
            browser: 'chrome',
            samples: 5,
            p75: 0.1234,
          },
          {
            name: 'LCP',
            route: '/shows/:slug',
            release: 'release-test',
            browser: 'chrome',
            samples: 7,
            p75: 2345.6,
          },
        ],
      },
      navigation: { available: true, rows: [] },
      errors: { available: false, rows: [] },
      player: { available: true, rows: [] },
    },
  }
  await page.route('**/api/admin/telemetry', (route) => route.fulfill({ json: payload }))
  await page.getByRole('button', { name: 'Refresh telemetry' }).click()
  await expect(page.getByRole('status')).toContainText('Some telemetry queries are unavailable')
  await expect(page.getByRole('article', { name: 'errors', exact: true })).toContainText(
    'Unavailable',
  )
  await expect(page.getByRole('article', { name: 'navigation', exact: true })).toContainText(
    'No events in this window.',
  )
  const vitals = page.getByRole('article', { name: 'Web vitals', exact: true })
  await expect(vitals.getByText('0.123', { exact: true })).toBeVisible()
  await expect(vitals.getByText('2,346 ms', { exact: true })).toBeVisible()
  await expect(vitals).toContainText('release-test / chrome')
  await test.info().attach('telemetry-partial-narrow', {
    body: await page.getByRole('region', { name: 'Browser and player health' }).screenshot(),
    contentType: 'image/png',
  })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  await test.info().attach('telemetry-partial-wide', {
    body: await page.getByRole('region', { name: 'Browser and player health' }).screenshot(),
    contentType: 'image/png',
  })
  await page.unroute('**/api/admin/telemetry')
  await page.route('**/api/admin/telemetry', (route) => route.fulfill({ status: 503 }))
  await page.getByRole('button', { name: 'Refresh telemetry' }).click()
  await expect(page.getByRole('alert')).toContainText('Request failed.')
  await expect(page.getByText('No sampled browser telemetry')).toHaveCount(0)
  await test.info().attach('telemetry-request-error', {
    body: await page.getByRole('alert').screenshot(),
    contentType: 'image/png',
  })
  await page.unroute('**/api/admin/telemetry')
  await page.route('**/api/admin/telemetry', (route) =>
    route.fulfill({
      json: {
        ...payload,
        state: 'empty',
        sections: {
          webVitals: { available: true, rows: [] },
          navigation: { available: true, rows: [] },
          errors: { available: true, rows: [] },
          player: { available: true, rows: [] },
        },
      },
    }),
  )
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(
    page.getByText('No sampled browser telemetry was recorded in the last 24 hours.'),
  ).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  await test.info().attach('telemetry-empty', {
    body: await page.getByRole('region', { name: 'Browser and player health' }).screenshot(),
    contentType: 'image/png',
  })
})
