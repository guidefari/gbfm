import { readFile } from 'node:fs/promises'
import { compile } from '@mdx-js/mdx'
import { expect, test } from '@playwright/test'

test.skip(
  !process.env.PLAYWRIGHT_LIVE_MUSIC,
  'Requires a local API with the four ambient editorial entities'
)

for (const [name, width, height] of [
  ['desktop', 1440, 1000],
  ['mobile', 390, 844]
] satisfies Array<[string, number, number]>) {
  test.describe(name, () => {
    test.use({ viewport: { width, height }, isMobile: name === 'mobile', deviceScaleFactor: 1 })

    test('renders the ambient draft with real catalog and Spotify track lists', async ({
      page
    }, testInfo) => {
      test.setTimeout(90000)
      const content = await readFile(
        new URL('./fixtures/ambient-editorial.md', import.meta.url),
        'utf8'
      )
      const compiledContent = String(await compile(content, { outputFormat: 'function-body' }))
      const albumResponses: Array<{ status: number; id: string | undefined }> = []
      page.on('response', (response) => {
        if (new URL(response.url()).pathname === '/api/spotify/album') {
          albumResponses.push({
            status: response.status(),
            id: response.request().postDataJSON()?.id
          })
        }
      })
      page.on('dialog', (dialog) => dialog.accept())
      await page.addInitScript(() =>
        localStorage.setItem('gbfm-onboarding.json', JSON.stringify({ hasSeenWelcome: true }))
      )
      await page.route('**/auth/get-session*', (route) =>
        route.fulfill({
          json: {
            user: {
              id: 'test-editor',
              name: 'Test Editor',
              email: 'editor@example.test',
              role: 'admin',
              emailVerified: true
            },
            session: {
              id: 'test-session',
              userId: 'test-editor',
              expiresAt: '2099-01-01T00:00:00.000Z'
            }
          }
        })
      )
      await page.route('**/content/posts/editorials/ambient-test-evidence', (route) =>
        route.fulfill({
          json: {
            id: 'ambient-test-evidence',
            title: 'Ambient listening notes',
            description: null,
            thumbnailUrl: null,
            slug: 'ambient-test-evidence',
            content,
            compiledContent,
            draft: false,
            tags: [],
            type: 'post',
            musicEntityType: null,
            musicEntityId: null,
            parentPostId: null,
            rootPostId: null,
            depth: 0,
            quotedPostId: null,
            createdAt: '2026-09-05',
            updatedAt: '2026-09-05',
            creators: []
          }
        })
      )

      await page.goto('/new/editorial')
      await page.getByPlaceholder('Story title').fill('Ambient listening notes')
      await page.locator('.cm-content').fill(content)
      await page.getByRole('button', { name: 'Preview', exact: true }).click()
      const preview = page.locator('.editorial-editor-preview')
      await expect(preview.getByRole('region', { name: 'Track list' })).toHaveCount(4, {
        timeout: 60000
      })
      await expect(preview.getByText(/Track list is unavailable|No tracks available/)).toHaveCount(
        0
      )
      await page.screenshot({
        path: testInfo.outputPath(`ambient-composer-${name}.png`),
        animations: 'disabled'
      })

      await page.goto('/editorial/ambient-test-evidence')
      const lists = page.getByRole('region', { name: 'Track list' })
      await expect(lists).toHaveCount(4, { timeout: 60000 })
      await expect(page.getByRole('heading', { name: 'American Dub Electronics' })).toBeVisible()
      await expect(lists.first().getByRole('listitem')).toHaveCount(11)
      const trackCounts = await lists.evaluateAll((elements) =>
        elements.map((element) => element.querySelectorAll('li').length)
      )
      expect(trackCounts.every((count) => count > 0)).toBe(true)
      expect(albumResponses.every((response) => response.status === 200)).toBe(true)
      expect(new Set(albumResponses.map((response) => response.id)).size).toBe(4)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
      await page
        .locator('article')
        .first()
        .screenshot({
          path: testInfo.outputPath(`ambient-album-${name}.png`),
          animations: 'disabled'
        })
      const contentHeight = await page.locator('.prose').evaluate((element) => element.scrollHeight)
      await page.setViewportSize({ width, height: contentHeight + 650 })
      await page
        .getByRole('link', { name: 'Editorial', exact: true })
        .first()
        .scrollIntoViewIfNeeded()
      await page.screenshot({
        path: testInfo.outputPath(`ambient-editorial-${name}.png`),
        fullPage: true,
        animations: 'disabled'
      })
      await testInfo.attach('live-track-results', {
        body: JSON.stringify({ albumResponses, trackCounts }, null, 2),
        contentType: 'application/json'
      })
    })
  })
}
