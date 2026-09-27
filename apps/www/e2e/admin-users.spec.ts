import { expect, test } from '@playwright/test'
import { Schema } from 'effect'

for (const scripting of [false, true]) {
  test.describe(scripting ? 'Hydrated account forms' : 'No-JavaScript account forms', () => {
    test.use({ javaScriptEnabled: scripting })

    test('admin account creation, role, invite, ban and deletion', async ({ page }, testInfo) => {
      await page.goto('/auth/sign-in')
      await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@gbfm.local')
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(page).toHaveURL(/\/dashboard$/)
      const email = `account-check-${scripting}-${Date.now()}@gbfm.local`
      await page.goto('/dashboard/users')
      if (scripting)
        await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()
      await page
        .locator('summary')
        .filter({ hasText: /^Create user$/ })
        .click()
      await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('Account Check')
      await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email)
      await page
        .getByRole('textbox', { name: 'Password (optional)', exact: true })
        .fill('LocalTest123!')
      await page.getByRole('button', { name: 'Create account', exact: true }).click()
      await expect(page.getByRole('status')).toHaveText('Account action completed.')
      const search = new URLSearchParams({ searchField: 'email', searchValue: email, limit: '5' })
      const readAccount = async () => {
        const response = await page.request.get(`/auth/admin/list-users?${search}`)
        return Schema.decodeUnknownSync(
          Schema.Struct({
            users: Schema.Array(
              Schema.Struct({ id: Schema.String, role: Schema.String, banned: Schema.Boolean }),
            ),
          }),
        )(await response.json()).users
      }
      const [created] = await readAccount()
      expect(created).toBeDefined()
      if (!created) throw new Error('Account fixture was not created')
      let removed = false
      try {
        await page.getByRole('searchbox', { name: 'Search by email', exact: true }).fill(email)
        await page.getByRole('button', { name: 'Search users', exact: true }).click()
        await expect(page.locator('.admin-users li')).toHaveCount(1)
        const account = page.locator('.admin-users li').filter({ hasText: email })
        await account.getByRole('combobox', { name: 'Role', exact: true }).selectOption('creator')
        await account.getByRole('button', { name: 'Save role', exact: true }).click()
        await expect(page.getByRole('status')).toHaveText('Account action completed.')
        expect((await readAccount())[0]?.role).toBe('creator')
        await account.getByRole('button', { name: 'Invite', exact: true }).click()
        await expect(page.getByRole('status')).toHaveText('Account action completed.')
        await account.locator('summary').filter({ hasText: /^Ban$/ }).click()
        await account
          .getByRole('textbox', { name: 'Ban reason (optional)', exact: true })
          .fill('Disposable test restriction')
        await account.getByRole('button', { name: 'Confirm ban', exact: true }).click()
        await expect(account).toContainText('Banned: Disposable test restriction')
        expect((await readAccount())[0]?.banned).toBe(true)
        if (scripting) {
          await account.evaluate((element) => element.scrollIntoView({ block: 'center' }))
          await testInfo.attach('user-banned-dark', {
            body: await account.screenshot(),
            contentType: 'image/png',
          })
          await page.emulateMedia({ colorScheme: 'light' })
          await page.reload()
          await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
        }
        await account.evaluate((element) => element.scrollIntoView({ block: 'center' }))
        await testInfo.attach('user-banned-light', {
          body: await account.screenshot(),
          contentType: 'image/png',
        })
        await account.getByRole('button', { name: 'Unban', exact: true }).click()
        await expect(account.getByRole('button', { name: 'Unban', exact: true })).toHaveCount(0)
        expect((await readAccount())[0]?.banned).toBe(false)
        await account
          .locator('summary')
          .filter({ hasText: /^Delete$/ })
          .click()
        await expect(account).toContainText('This cannot be undone.')
        await account.getByRole('button', { name: 'Confirm delete', exact: true }).click()
        await expect(account).toHaveCount(0)
        expect(await readAccount()).toEqual([])
        removed = true
      } finally {
        if (!removed)
          await page.request.post('/auth/admin/remove-user', {
            headers: { origin: new URL(page.url()).origin },
            data: { userId: created.id },
          })
      }
    })
  })
}

test('native account actions reject cross-origin posts and non-admin role escalation', async ({
  request,
  baseURL,
}) => {
  if (!baseURL) throw new Error('The local application URL is required')
  const forbidden = await request.post('/actions/admin/create-user', {
    headers: { origin: 'https://untrusted.example' },
    form: { name: 'Forbidden', email: 'forbidden@gbfm.local', role: 'admin' },
    maxRedirects: 0,
  })
  expect(forbidden.status()).toBe(403)
  const login = await request.post('/auth/sign-in/email', {
    headers: { origin: baseURL },
    data: { email: 'listener@gbfm.local', password: 'LocalTest123!' },
  })
  expect(login.ok()).toBe(true)
  const Session = Schema.Struct({ user: Schema.Struct({ id: Schema.String, role: Schema.String }) })
  const before = Schema.decodeUnknownSync(Session)(
    await (await request.get('/auth/get-session')).json(),
  )
  const escalation = await request.post('/actions/admin/set-role', {
    headers: { origin: baseURL },
    form: { userId: before.user.id, role: 'admin' },
    maxRedirects: 0,
  })
  expect(escalation.status()).toBe(303)
  expect(escalation.headers().location).toContain('notice=failed')
  const after = Schema.decodeUnknownSync(Session)(
    await (await request.get('/auth/get-session')).json(),
  )
  expect(after.user.role).toBe('user')
})
