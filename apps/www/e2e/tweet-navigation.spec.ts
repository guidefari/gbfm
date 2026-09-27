import { expect, test } from '@playwright/test'

test('year and month jumps navigate the archive without triggering background keyboard shortcuts', async ({
  page,
}) => {
  await page.goto('/tweet/e2e-archive-one')
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()
  await page.locator('summary[aria-label="Jump to year"]').click()
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  await page
    .getByRole('navigation', { name: 'Jump to year', exact: true })
    .getByRole('link', { name: /^2020/ })
    .click()
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
  await page.locator('summary[aria-label="Jump within 2020"]').click()
  await page
    .getByRole('navigation', { name: 'Jump within 2020', exact: true })
    .getByRole('link', { name: /^Jan/ })
    .click()
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  await expect(page.getByRole('link', { name: 'Jump to Feb 2020', exact: true })).toHaveAttribute(
    'href',
    '/tweet/e2e-archive-two',
  )
  await expect(page.locator('.tweet-month-marker')).toBeVisible()
})

test('archive disclosures and links remain usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/tweet/e2e-archive-one')
  await page.locator('summary[aria-label="Jump within 2020"]').click()
  await page
    .getByRole('navigation', { name: 'Jump within 2020', exact: true })
    .getByRole('link', { name: /^Feb/ })
    .click()
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
  await context.close()
})

test('tweet read mode persists across reload and keyboard navigation falls back when all older tweets were seen', async ({
  page,
  context,
}) => {
  await page.goto('/tweet/e2e-archive-one')
  await expect(page.getByRole('checkbox', { name: 'Skip seen' })).toBeChecked()
  await page.getByRole('checkbox', { name: 'Skip seen' }).uncheck()
  await expect
    .poll(
      async () =>
        (await context.cookies()).find((cookie) => cookie.name === 'gbfm-tweet-read-mode')?.value,
    )
    .toBe('all')
  expect(
    (await context.cookies()).find((cookie) => cookie.name === 'gbfm-tweet-read-mode')?.httpOnly,
  ).toBe(true)
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Skip seen' })).not.toBeChecked()
  await page.getByRole('link', { name: 'Newer tweet', exact: true }).focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
  await page.getByRole('checkbox', { name: 'Skip seen' }).check()
  await expect(page.getByRole('link', { name: 'Older tweet', exact: true })).toHaveAttribute(
    'href',
    '/tweet/e2e-archive-one',
  )
  await page.getByRole('link', { name: 'Older tweet', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Menu', exact: true })).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
})

test('legacy new-tweet URL redirects to the composer rather than looking up a tweet named new', async ({
  request,
}) => {
  const response = await request.get('/tweet/new', { maxRedirects: 0 })
  expect(response.status()).toBe(303)
  expect(response.headers().location).toBe('/new/tweet')
})

test('random unread form loads another published tweet through the local API', async ({ page }) => {
  const seen = page.waitForResponse(
    (response) =>
      response.url().endsWith('/e2e-archive-one/seen') && response.request().method() === 'POST',
  )

  await page.goto('/tweet/e2e-archive-one')
  expect((await seen).ok()).toBe(true)
  await page.getByRole('button', { name: 'Random unread', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/(?!e2e-archive-one)[^?]+$/)
  await expect(page.getByRole('checkbox', { name: 'Skip seen' })).toBeVisible()
  await expect(page.getByText('No unread tweet could be loaded. Try again.')).toHaveCount(0)
})
