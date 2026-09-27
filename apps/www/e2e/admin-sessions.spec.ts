import { expect, test } from '@playwright/test'
import { Schema } from 'effect'

test('admin inspects and revokes isolated D1-backed sessions without exposing tokens in rendered state', async ({
  page,
  playwright,
}, testInfo) => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const origin = new URL(page.url()).origin
  const email = `session-check-${Date.now()}@gbfm.local`
  const created = await page.request.post('/auth/admin/create-user', {
    headers: { origin },
    data: { name: 'Session Check', email, password: 'LocalTest123!', role: 'user' },
  })
  expect(created.ok()).toBe(true)
  const { user } = Schema.decodeUnknownSync(
    Schema.Struct({ user: Schema.Struct({ id: Schema.String }) }),
  )(await created.json())
  const first = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { origin, 'user-agent': 'GBFM fixture-one' },
  })
  const second = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { origin, 'user-agent': 'GBFM fixture-two' },
  })
  try {
    for (const context of [first, second]) {
      const result = await context.post('/auth/sign-in/email', {
        data: { email, password: 'LocalTest123!' },
      })
      expect(result.ok()).toBe(true)
    }
    await page.goto('/dashboard/sessions')
    await page.getByRole('searchbox', { name: 'Search user by email' }).fill(email)
    await page.getByRole('button', { name: 'Search users', exact: true }).click()
    await page.getByRole('button', { name: `Session Check · ${email}`, exact: true }).click()
    await expect(page.locator('.session-list li')).toHaveCount(2)
    await page.locator('.session-list').scrollIntoViewIfNeeded()
    await testInfo.attach('session-list-dark', {
      body: await page.locator('.dashboard-content').screenshot(),
      contentType: 'image/png',
    })
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await testInfo.attach('session-list-light', {
      body: await page.locator('.dashboard-content').screenshot(),
      contentType: 'image/png',
    })
    const rawSessions = await page.request.post('/auth/admin/list-user-sessions', {
      headers: { origin },
      data: { userId: user.id },
    })
    const { sessions } = Schema.decodeUnknownSync(
      Schema.Struct({ sessions: Schema.Array(Schema.Struct({ token: Schema.String })) }),
    )(await rawSessions.json())
    const html = await page.content()
    for (const session of sessions) expect(html.includes(session.token)).toBe(false)
    await page
      .locator('.session-list li')
      .filter({ hasText: 'GBFM fixture-one' })
      .getByRole('button', { name: 'Revoke session' })
      .click()
    await expect(page.locator('.session-list li')).toHaveCount(1)
    expect((await first.get('/api/user/profile')).status()).toBe(401)
    expect((await (await first.get('/auth/get-session')).json()) === null).toBe(true)
    expect((await (await second.get('/auth/get-session')).json()) !== null).toBe(true)
    await page.getByRole('button', { name: 'Revoke all', exact: true }).click()
    await expect(page.getByText('They will need to sign in again.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Confirm revoke all', exact: true }).click()
    await expect(page.getByText('No active sessions found.', { exact: true })).toBeVisible()
    expect((await second.get('/api/user/profile')).status()).toBe(401)
    expect((await (await second.get('/auth/get-session')).json()) === null).toBe(true)
  } finally {
    await first.dispose()
    await second.dispose()
    const removed = await page.request.post('/auth/admin/remove-user', {
      headers: { origin },
      data: { userId: user.id },
    })
    expect(removed.ok()).toBe(true)
  }
})
