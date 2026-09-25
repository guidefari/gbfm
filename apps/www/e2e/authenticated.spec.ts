import { expect, test, type Page } from '@playwright/test'

const password = 'LocalTest123!'

async function signIn(page: Page, email: string, redirect = '/dashboard') {
  await page.goto(`/auth/sign-in?redirect=${encodeURIComponent(redirect)}`)
  await page.getByLabel('Email or username').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === redirect)
}

test('listener can use member settings but cannot access creator or admin tools', async ({
  page
}) => {
  await signIn(page, 'listener@gbfm.local')
  await expect(page.getByRole('heading', { name: /Welcome back, Local/i })).toBeVisible()

  let response = await page.goto('/dashboard/profile')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Account Profile' })).toBeVisible()

  response = await page.goto('/new')
  expect(response?.status()).toBe(403)
  response = await page.goto('/dashboard/users')
  expect(response?.status()).toBe(403)
})

test('creator can save and reopen a draft but cannot access admin tools', async ({ page }) => {
  await signIn(page, 'creator@gbfm.local', '/new')
  await expect(page.getByRole('heading', { name: 'New content' })).toBeVisible()

  const slug = `e2e-creator-draft-${Date.now()}`
  await page.getByLabel('Title / tweet').fill('E2E creator draft')
  await page.getByLabel('Slug').fill(slug)
  await page.getByLabel('Body (Markdown)').fill('Created by the authenticated SvelteKit E2E suite.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Draft saved')).toBeVisible()

  await page.goto('/dashboard/content/tweets')
  await expect(page.getByRole('heading', { name: 'Your Tweets' })).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: slug })
  await expect(row).toBeVisible()
  await row.getByRole('link', { name: 'Edit' }).click()
  await expect(page.getByRole('heading', { name: 'Edit content' })).toBeVisible()
  await expect(page.getByLabel('Slug')).toHaveValue(slug)

  const response = await page.goto('/dashboard/users')
  expect(response?.status()).toBe(403)
})

test('editor has publishing access without administrator access', async ({ page }) => {
  await signIn(page, 'editor@gbfm.local', '/new?mode=editorial')
  await expect(page.getByRole('heading', { name: 'New content' })).toBeVisible()
  await expect(page.getByRole('combobox')).toHaveValue('post')

  let response = await page.goto('/dashboard/content/editorial')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Your Editorial' })).toBeVisible()

  response = await page.goto('/dashboard/overview')
  expect(response?.status()).toBe(403)
})

test('administrator can access creator and platform administration routes', async ({ page }) => {
  await signIn(page, 'admin@gbfm.local')

  const routes = [
    ['/new', 'New content'],
    ['/mix-upload', 'Upload a mix'],
    ['/dashboard/admin', 'Admin Dashboard'],
    ['/dashboard/overview', 'Admin Overview'],
    ['/dashboard/users', 'Users'],
    ['/dashboard/sessions', 'Sessions'],
    ['/dashboard/shows', 'Shows'],
    ['/dashboard/music', 'Music Catalog'],
    ['/dashboard/playlists', 'Playlist Management'],
    ['/dashboard/newsletter', 'Newsletter'],
    ['/dashboard/email-logs', 'Email Logs'],
    ['/dashboard/frontend-errors', 'Frontend Telemetry'],
    ['/dashboard/all/mixes', 'All Mixes'],
    ['/dashboard/all/tweets', 'All Tweets'],
    ['/dashboard/all/editorial', 'All Editorial']
  ] as const

  for (const [path, heading] of routes) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Request failed \(\d+\)|Could not load/i)).toHaveCount(0)
  }
})

test('player preferences persist across navigation and reload', async ({ page }) => {
  await signIn(page, 'listener@gbfm.local', '/dashboard/player')
  const continueQueue = page.getByLabel('Continue through queue')
  const restorePosition = page.getByLabel('Restore listening position')
  await continueQueue.uncheck()
  await restorePosition.uncheck()
  await page.getByRole('button', { name: 'Save player settings' }).click()
  await expect(page.getByText('Player preferences saved.')).toBeVisible()

  await page.reload()
  await expect(continueQueue).not.toBeChecked()
  await expect(restorePosition).not.toBeChecked()
})
