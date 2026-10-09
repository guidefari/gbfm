import { expect, test } from '@playwright/test'

test('admin selects a mix, retries a failed save, and restores automatic selection', async ({
  page,
}) => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/featured-mix')
  const select = page.getByRole('combobox', { name: 'Featured mix', exact: true })
  const save = page.getByRole('button', { name: 'Save featured mix', exact: true })
  await expect(select).toHaveValue('')
  await expect(save).toBeDisabled()
  await select.selectOption({ label: 'Local Frequencies' })
  await page.route(
    '**/api/admin/featured-mix',
    async (route) => {
      if (route.request().method() === 'PUT') await route.fulfill({ status: 503, body: '' })
      else await route.continue()
    },
    { times: 1 },
  )
  await save.click()
  await expect(page.getByRole('alert')).toContainText('Request failed.')
  await expect(select.locator('option:checked')).toHaveText('Local Frequencies')
  await save.click()
  await expect(page.getByRole('status')).toHaveText('Current selection: Local Frequencies')
  await page.reload()
  await expect(select.locator('option:checked')).toHaveText('Local Frequencies')
  await page.goto('/')
  await expect(page.locator('.featured-title')).toHaveText('Local Frequencies')
  await expect(page.locator('.featured-creators')).toHaveText('Local Creator')
  await page.getByRole('button', { name: 'Play mix', exact: true }).click()
  const player = page.getByRole('dialog', { name: 'Now playing', exact: true })
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await player.getByRole('button', { name: 'Pause', exact: true }).click()
  await player.getByRole('button', { name: 'Collapse player' }).click()
  await page.goto('/dashboard/featured-mix')
  await select.selectOption('')
  await save.click()
  await expect(page.getByRole('status')).toHaveText(
    'Current selection: Automatic — newest published mix',
  )
  await page.reload()
  await expect(select).toHaveValue('')
})
