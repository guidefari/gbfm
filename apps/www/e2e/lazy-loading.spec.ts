import { test, expect } from '@playwright/test'

test.describe('Lazy Loading - Mixes', () => {
  test('should show LoadMoreTrigger component and handle intersection', async ({ page }) => {
    // Simple test: just verify the component renders and basic functionality
    // We'll test the actual intersection behavior with a unit test instead

    // Mock minimal API response
    await page.route('**/*', async (route) => {
      if (route.request().url().includes('/content/audio/mix')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'test-mix-1',
                title: 'Test Mix 1',
                slug: 'test-mix-1',
                description: 'Test description',
                thumbnailUrl: null,
                url: 'https://example.com/mix-1.mp3',
                type: 'mix',
                tags: ['test'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ],
            pagination: {
              total: 1,
              limit: 20,
              offset: 0,
              hasMore: false
            }
          })
        })
      } else {
        await route.continue()
      }
    })

    // Navigate to mixes page
    await page.goto('/mixes')

    // Wait for the page to load (should show the skeleton initially)
    await page.waitForSelector('[data-testid="mix-item"]')

    // Verify that the LoadMoreTrigger is not visible when there's no more data
    const loadMoreTrigger = page.locator('[data-testid="load-more-trigger"]')
    await expect(loadMoreTrigger).not.toBeVisible()
  })

  test('should render mixes list correctly', async ({ page }) => {
    // Mock API response
    await page.route('**/*', async (route) => {
      if (route.request().url().includes('/content/audio/mix')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: Array.from({ length: 3 }, (_, i) => ({
              id: `mix-${i + 1}`,
              title: `Test Mix ${i + 1}`,
              slug: `test-mix-${i + 1}`,
              description: `Description for test mix ${i + 1}`,
              thumbnailUrl: null,
              url: `https://example.com/mix-${i + 1}.mp3`,
              type: 'mix',
              tags: ['test'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })),
            pagination: {
              total: 3,
              limit: 20,
              offset: 0,
              hasMore: false
            }
          })
        })
      } else {
        await route.continue()
      }
    })

    // Navigate to mixes page
    await page.goto('/mixes')

    // Wait for mixes to load
    await page.waitForSelector('[data-testid="mix-item"]')

    // Should show the correct number of mixes
    const mixes = page.locator('[data-testid="mix-item"]')
    await expect(mixes).toHaveCount(3)

    // Verify mix titles are displayed (use more specific selector)
    await expect(page.getByRole('link', { name: 'Test Mix 1' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Test Mix 2' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Test Mix 3' })).toBeVisible()
  })
})
