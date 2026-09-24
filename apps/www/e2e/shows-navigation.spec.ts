import { expect, test } from '@playwright/test'

const show = {
  id: 'show_1',
  title: 'FAR END RADIO',
  description: null,
  thumbnailUrl: null,
  bannerImageUrl: null,
  slug: 'farendradio',
  content: '',
  draft: false,
  tags: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: [{ id: 'host_1', name: '[kimetsu.]' }]
}

test('selecting the default radio show stays on the shows route', async ({ page }) => {
  await page.route('**/auth/get-session**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  )
  await page.route('**/api/shows**', (route) => {
    const { pathname } = new URL(route.request().url())
    return route.fulfill({
      json:
        pathname === '/api/shows'
          ? {
              data: [show],
              pagination: { total: 1, limit: 50, offset: 0, hasMore: false }
            }
          : {
              data: [],
              pagination: { total: 0, limit: 50, offset: 0, hasMore: false }
            }
    })
  })

  await page.goto('/shows')

  await expect(page).toHaveURL(/\/shows\?show=farendradio$/)
  await expect(page.getByRole('heading', { name: 'Episodes' })).toBeVisible()
})
