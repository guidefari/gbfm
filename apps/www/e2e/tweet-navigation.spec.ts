import { expect, test } from '@playwright/test'

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
  await page.getByRole('link', { name: 'Newer', exact: true }).focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
  await page.getByRole('checkbox', { name: 'Skip seen' }).check()
  await expect(page.getByRole('link', { name: 'Older', exact: true })).toHaveAttribute(
    'href',
    '/tweet/e2e-archive-one',
  )
  await page.getByRole('link', { name: 'Older', exact: true }).focus()
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
  await page.getByRole('button', { name: 'Random unread tweet', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/(?!e2e-archive-one)[^?]+$/)
  await expect(page.getByRole('checkbox', { name: 'Skip seen' })).toBeVisible()
  await expect(page.getByText('No unread tweet could be loaded. Try again.')).toHaveCount(0)
})
