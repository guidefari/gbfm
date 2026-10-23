import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('admin filters subscribers, reviews a deduplicated eligible audience, sends and finds the receipt', async ({
  page,
}) => {
  await page.goto('/dashboard/newsletter')
  await expect(page.getByRole('heading', { name: 'Subscribers', exact: true })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search subscribers' }).fill('former')
  await expect(page.locator('.comms-list li')).toHaveCount(1)
  await expect(page.locator('.comms-list')).toContainText('Unsubscribed')
  await page.getByRole('combobox', { name: 'Subscription status' }).selectOption('subscribed')
  await expect(page.getByText('No subscribers match these filters.')).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Comms', exact: true })
    .getByRole('link', { name: 'Write email' })
    .click()
  await page.getByRole('combobox', { name: 'Published mix' }).selectOption('e2e-local-frequencies')
  await page.getByRole('combobox', { name: 'Audience', exact: true }).selectOption('selected')
  await page
    .getByRole('textbox', { name: 'Email addresses' })
    .fill('AYA@example.test, aya@example.test; former@example.test')
  await page.getByRole('button', { name: 'Review announcement' }).click()
  await expect(page.getByRole('heading', { name: 'Review announcement' })).toBeVisible()
  await expect(page.getByText('1 recipients at review', { exact: true })).toBeVisible()
  await page.getByText('1 address(es) excluded', { exact: true }).click()
  await expect(page.locator('.comms-summary')).toContainText('former@example.test')
  const send = page.getByRole('button', { name: 'Send announcement', exact: true })
  await expect(send).toBeDisabled()
  await page.getByRole('checkbox').check()
  await send.click()
  await expect(page.getByRole('status')).toContainText('Successfully sent 1 notification(s)')
  await expect(send).toHaveCount(0)
  await page.getByRole('link', { name: 'View delivery history' }).click()
  await page.getByRole('searchbox', { name: 'Recipient email' }).fill('aya@example.test')
  await page.getByRole('combobox', { name: 'Delivery status' }).selectOption('SENT')
  await page.getByRole('button', { name: 'Filter history' }).click()
  await expect(page.locator('.comms-list')).toContainText('New mix: Local Frequencies')
  await expect(page.locator('.comms-list')).toContainText('aya@example.test')
  await expect(page.locator('.comms-list')).toContainText('Accepted')
  await expect(page.locator('.comms-list')).not.toContainText('former@example.test')
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Delivery status' })).toHaveValue('SENT')
  await page.getByRole('combobox', { name: 'Delivery status' }).selectOption('FAILED')
  await page.getByRole('button', { name: 'Filter history' }).click()
  await expect(page).toHaveURL(/status=FAILED/)
  await expect(page.getByText('No emails match these filters.')).toBeVisible()
})

test('an empty selected audience never falls back to everyone and an ambiguous send cannot be retried', async ({
  page,
}) => {
  await page.goto('/dashboard/emails')
  await page.getByRole('combobox', { name: 'Published mix' }).selectOption('e2e-local-frequencies')
  await page.getByRole('combobox', { name: 'Audience', exact: true }).selectOption('selected')
  await page.getByRole('textbox', { name: 'Email addresses' }).fill('former@example.test')
  await page.getByRole('button', { name: 'Review announcement' }).click()
  await expect(page.getByRole('alert')).toContainText('No eligible recipients')
  await expect(page.getByRole('button', { name: 'Send announcement', exact: true })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Email addresses' }).fill('ben@example.test')
  await page.getByRole('button', { name: 'Review announcement' }).click()
  await page.getByRole('checkbox').check()
  await page.route('**/api/email/send-mix-notification', (route) => route.abort('failed'), {
    times: 1,
  })
  await page.getByRole('button', { name: 'Send announcement', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Some emails may have been accepted')
  await expect(page.getByRole('button', { name: 'Send announcement', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'View delivery history' })).toBeVisible()
})

test('delivery history preserves filters across pages and dates exclude out-of-range messages', async ({
  page,
}) => {
  await page.goto('/dashboard/email-logs?recipientEmail=history%40example.test&status=SENT')
  await expect(page.locator('.comms-list li')).toHaveCount(25)
  await page.getByRole('link', { name: 'Next →', exact: true }).click()
  await expect(page.locator('.comms-list li')).toHaveCount(2)
  await expect(page).toHaveURL(/recipientEmail=history%40example.test.*status=SENT.*offset=25/)
  await page.getByRole('link', { name: '← Previous', exact: true }).click()
  await expect(page.locator('.comms-list li')).toHaveCount(25)
  await page.getByLabel('From date').fill('2026-09-26')
  await page.getByLabel('To date').fill('2026-09-26')
  await page.getByRole('button', { name: 'Filter history' }).click()
  await expect(page.locator('.comms-list li')).toHaveCount(1)
  await expect(page.locator('.comms-list')).toContainText('Archived announcement 26')
})
