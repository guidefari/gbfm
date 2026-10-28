import { expect, test } from '@playwright/test'

test('editorial listing retains its seeded content on a cold load and reload', async ({ page }) => {
  const checkListing = async () => {
    const article = page.getByRole('article').filter({ hasText: 'Local listening notes' })
    await expect(article).toBeVisible()
    await expect(
      article.getByRole('link', { name: 'Local listening notes', exact: true }),
    ).toHaveAttribute('href', '/editorial/e2e-listening-notes')
    await expect(article.getByRole('link', { name: '#local-music', exact: true })).toHaveAttribute(
      'href',
      '/tags/local-music',
    )
  }

  expect((await page.goto('/editorial'))?.status()).toBe(200)
  await checkListing()
  expect((await page.reload())?.status()).toBe(200)
  await checkListing()
})
