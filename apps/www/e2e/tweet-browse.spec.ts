import { expect, test, type Page } from '@playwright/test'

const ready = (page: Page) =>
  expect(page.locator('.site')).toHaveAttribute('data-interactive', 'true')

test('browse shows content choices without recording any tweet as read', async ({ page }) => {
  const writes: Array<string> = []
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      /\/micro\/[^/]+\/seen$/.test(new URL(request.url()).pathname)
    )
      writes.push(request.url())
  })
  await page.goto('/tweets?q=archive')
  await ready(page)
  await expect(page.getByRole('heading', { name: 'Browse tweets', exact: true })).toBeVisible()
  await expect(page.locator('.tweet-browse-row').first()).toBeVisible()
  expect(await page.locator('.tweet-browse-row').count()).toBeGreaterThan(1)
  await expect(page.locator('.tweet-browse-row').first()).toContainText(/\d{4}/)
  expect(writes).toEqual([])
})

test('desktop selection keeps the browse list beside the full reader and retains list position', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/tweets?q=archive')
  await ready(page)

  const previous = await page.locator('[data-browse-scroll]').evaluate((list) => {
    list.scrollTop = 120
    const link = list.querySelector('.tweet-browse-row')

    if (!(link instanceof HTMLAnchorElement)) throw new Error('Missing tweet link')
    const before = list.scrollTop
    link.click()

    return before
  })

  await expect(page.locator('.tweet-browser')).toHaveAttribute('data-selected', /.+/)
  await expect(page.locator('.tweet-browser-sidebar')).toBeVisible()
  await expect(page.locator('.tweet-browser-reader article').first()).toBeVisible()
  await expect(page.locator('.tweet-browse-row[aria-current="page"]')).toHaveCount(1)
  await expect
    .poll(() => page.locator('[data-browse-scroll]').evaluate((list) => list.scrollTop))
    .toBe(previous)
})

test('phone selection opens a full-width reader and returns to the same browse position', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tweets?q=archive')
  await ready(page)

  const previous = await page.locator('[data-browse-scroll]').evaluate((list) => {
    list.scrollTop = 120
    const before = list.scrollTop
    const link = list.querySelector('.tweet-browse-row')

    if (!(link instanceof HTMLAnchorElement)) throw new Error('Missing tweet link')
    link.click()

    return before
  })

  await expect(page.locator('.tweet-browser')).toHaveAttribute('data-selected', /.+/)
  await expect(page.locator('.tweet-browser-sidebar')).toBeHidden()
  await expect(page.locator('.tweet-browser-reader article').first()).toBeVisible()
  await page.getByRole('link', { name: 'Back to browse', exact: false }).click()
  await expect(page.locator('.tweet-browser')).not.toHaveAttribute('data-selected', /.+/)
  await expect(page.locator('.tweet-browser-sidebar')).toBeVisible()
  await expect
    .poll(() => page.locator('[data-browse-scroll]').evaluate((list) => list.scrollTop))
    .toBe(previous)
})

test('date filtering shows matching tweet previews rather than opening an arbitrary tweet', async ({
  page,
}) => {
  await page.goto('/tweets?q=archive')
  await ready(page)
  await page.getByRole('combobox', { name: 'Browse by date' }).selectOption('2020-02')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page).toHaveURL(/month=2020-02/)
  await expect(page.locator('.tweet-browse-row').first()).toBeVisible()

  const dates = await page
    .locator('.tweet-browse-row')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-tweet-date')))

  expect(dates.length).toBeGreaterThan(0)
  expect(dates.every((date) => date?.startsWith('2020-02'))).toBe(true)
  await expect(page.locator('.tweet-browser')).not.toHaveAttribute('data-selected', /.+/)
})

test('reading options remain compact with discovery outside the menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tweet/e2e-archive-one')
  await ready(page)
  await expect(page.getByRole('link', { name: 'Browse tweets', exact: true })).toBeVisible()
  await page.locator('summary[aria-label="Reading options"]').click()
  await expect(page.getByRole('navigation', { name: 'Tweets per month' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Surprise me', exact: true })).toBeVisible()
  const box = await page.locator('.tweet-reader-options').boundingBox()
  expect(box?.height).toBeLessThan(550)
})

for (const width of [320, 390, 768, 1280]) {
  test(`browse fits ${width}px with touch-sized date controls`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/tweets?q=archive')
    await ready(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    const box = await page.getByRole('combobox', { name: 'Browse by date' }).boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    await expect(page.locator('.tweet-browse-row').first()).toBeVisible()
  })
}
