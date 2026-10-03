import { GetAllShowsResponse } from '@gbfm/api/shows'
import { expect, test } from '@playwright/test'
import { Schema } from 'effect'

test('show drafts, failed edits, publication and confirmed deletion persist in D1', async ({
  page,
  playwright,
  baseURL,
}, testInfo) => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const slug = `show-check-${Date.now()}`
  const anonymous = await playwright.request.newContext({ baseURL })
  await page.goto('/dashboard/shows')
  const form = page.locator('.dashboard-content form')
  await form.getByRole('textbox', { name: 'Title', exact: true }).fill('A private show draft')
  await form.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug)
  await form.getByRole('textbox', { name: 'Content', exact: true }).fill('A full show description.')
  await form
    .getByRole('textbox', { name: 'Tags (comma separated)', exact: true })
    .fill('house, ambient')
  await form.getByRole('button', { name: 'Create show', exact: true }).click()
  const row = page.locator('.dashboard-list li').filter({ hasText: slug })
  await expect(row).toContainText('Draft')
  try {
    expect((await anonymous.get(`/api/shows/${slug}`)).status()).toBe(404)
    await page.reload()
    await row.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(
      form.getByRole('textbox', { name: 'Tags (comma separated)', exact: true }),
    ).toHaveValue('house, ambient')
    await form.getByRole('textbox', { name: 'Title', exact: true }).fill('Published from Foldkit')
    await form.getByRole('checkbox', { name: 'Draft', exact: true }).uncheck()
    await page.route(
      `**/api/shows/${slug}`,
      (route) => route.fulfill({ status: 503, json: { error: 'Temporary local test failure' } }),
      { times: 1 },
    )
    await form.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Could not save the show')
    await expect(form.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      'Published from Foldkit',
    )
    await form.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(row).toContainText('Published')
    const published = await anonymous.get(`/api/shows/${slug}`)
    expect(published.ok()).toBe(true)
    const detail = Schema.decodeUnknownSync(
      Schema.Struct({
        title: Schema.String,
        content: Schema.String,
        tags: Schema.Array(Schema.String),
        draft: Schema.Boolean,
      }),
    )(await published.json())
    expect(detail).toEqual({
      title: 'Published from Foldkit',
      content: 'A full show description.',
      tags: ['house', 'ambient'],
      draft: false,
    })
    for (const theme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: theme })
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await row.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await testInfo.attach(`show-admin-${theme}`, {
        body: await row.screenshot(),
        contentType: 'image/png',
      })
    }
    await row.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('button', { name: 'Keep show', exact: true }).click()
    expect((await anonymous.get(`/api/shows/${slug}`)).ok()).toBe(true)
    await row.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm delete', exact: true }).click()
    await expect(row).toHaveCount(0)
    expect((await anonymous.get(`/api/shows/${slug}`)).status()).toBe(404)
    const managed = Schema.decodeUnknownSync(GetAllShowsResponse)(
      await (await page.request.get('/api/shows/manage?limit=100&offset=0')).json(),
    )
    expect(managed.data.some((show) => show.slug === slug)).toBe(false)
  } finally {
    await page.request.delete(`/api/shows/${slug}`)
    await anonymous.dispose()
  }
})
