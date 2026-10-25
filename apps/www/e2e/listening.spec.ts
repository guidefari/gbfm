import { expect, test } from '@playwright/test'

test('listeners capture privately, annotate, collect, publish and unpublish without exposing drafts', async ({
  page,
  browser,
}) => {
  const suffix = crypto.randomUUID()
  const title = `Listening fixture ${suffix}`
  const collectionName = `Night selections ${suffix}`
  await page.goto('/auth/sign-in?returnTo=%2Flistening')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('listener@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Your listening pile', exact: true }),
  ).toBeVisible()
  await expect(page.locator('[data-interactive="true"]')).toBeVisible()

  const submit = async (operation: string, buttonName: string) => {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/actions/listening/${operation}`) && response.status() === 303,
      ),
      page.getByRole('button', { name: buttonName, exact: true }).click(),
    ])
    await page.waitForLoadState('load')
    await expect(page.locator('[data-interactive="true"]')).toBeVisible()
  }

  await page.locator('summary').filter({ hasText: '+ New collection' }).click()
  await page.getByRole('textbox', { name: 'Collection name', exact: true }).fill(collectionName)
  await page.getByRole('checkbox', { name: 'Make collection public', exact: true }).check()
  await submit('create-collection', 'Create collection')
  await expect(
    page.getByRole('link', { name: `${collectionName} · public`, exact: true }),
  ).toBeVisible()

  await page
    .getByRole('textbox', { name: 'Mix or public playlist URL', exact: true })
    .fill(`https://soundcloud.com/local-fixture/mix-${suffix}`)
  await page.getByRole('button', { name: 'Preview import', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Import preview · 1 mixes', exact: true }),
  ).toBeVisible()
  await expect(page.locator('[data-interactive="true"]')).toBeVisible()
  await submit('save-import', 'Save selected mixes privately')
  const card = page.locator('article').filter({ hasText: `mix-${suffix}` })
  await expect(card).toContainText('Private draft')
  await card.locator('summary').filter({ hasText: 'Notes & collections' }).click()
  await card.getByRole('textbox', { name: 'Mix title', exact: true }).fill(title)
  await card
    .getByRole('textbox', { name: 'Listening notes', exact: true })
    .fill('Private thought: the transition at 14:20 makes this set.')
  await submit('edit-mix', 'Save notes & status')
  const savedCard = page.locator('article').filter({ hasText: title })
  await savedCard.locator('summary').filter({ hasText: 'Notes & collections' }).click()
  await submit('membership', `+ Add to ${collectionName}`)
  await expect(page.locator('article').filter({ hasText: title })).toBeVisible()

  await page.getByRole('link', { name: `${collectionName} · public`, exact: true }).click()
  await page.locator('summary').filter({ hasText: 'Collection settings' }).click()
  const publicPath = await page
    .getByRole('link', { name: 'View public collection ↗', exact: true })
    .getAttribute('href')
  if (!publicPath) throw new Error('Public collection link missing')
  const anonymous = await browser.newContext()
  try {
    const publicPage = await anonymous.newPage()
    await publicPage.goto(new URL(publicPath, page.url()).href)
    await expect(
      publicPage.getByRole('heading', { name: collectionName, exact: true }),
    ).toBeVisible()
    await expect(
      publicPage.getByText('No published mixes in this collection yet.', { exact: true }),
    ).toBeVisible()
    await expect(publicPage.locator('body')).not.toContainText('Private thought')

    const editable = page.locator('article').filter({ hasText: title })
    await editable.locator('summary').filter({ hasText: 'Notes & collections' }).click()
    await editable
      .getByRole('checkbox', { name: 'Publish this mix and its notes', exact: true })
      .check()
    await submit('edit-mix', 'Save notes & status')
    await expect(page.locator('article').filter({ hasText: title })).toContainText('Published')
    await publicPage.reload()
    await expect(publicPage.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(publicPage.locator('article')).toContainText(
      'Private thought: the transition at 14:20 makes this set.',
    )
    await expect(
      publicPage.getByRole('link', { name: 'Open on original platform ↗', exact: true }),
    ).toHaveAttribute('href', `https://soundcloud.com/local-fixture/mix-${suffix}`)

    await page
      .locator('article')
      .filter({ hasText: title })
      .locator('summary')
      .filter({ hasText: 'Notes & collections' })
      .click()
    await page
      .getByRole('checkbox', { name: 'Publish this mix and its notes', exact: true })
      .uncheck()
    await submit('edit-mix', 'Save notes & status')
    await expect(page.locator('article').filter({ hasText: title })).toContainText('Private draft')
    await publicPage.reload()
    await expect(publicPage.locator('body')).not.toContainText('Private thought')
  } finally {
    await anonymous.close()
  }
})
