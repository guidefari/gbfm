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
  const subscribers = page.getByRole('table', { name: 'Newsletter subscribers' })
  await page.getByRole('searchbox', { name: 'Search subscribers' }).fill('former')
  await expect(subscribers.locator('tbody > tr.admin-row')).toHaveCount(1)
  await expect(subscribers).toContainText('Unsubscribed')
  await page
    .getByRole('group', { name: 'Subscription status' })
    .getByRole('button', { name: 'Subscribed', exact: true })
    .click()
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
  await expect(page.getByText('1 recipient at review', { exact: true })).toBeVisible()
  await page.getByText('1 address excluded', { exact: true }).click()
  await expect(page.locator('.comms-summary')).toContainText('former@example.test')
  const send = page.getByRole('button', { name: 'Send announcement', exact: true })
  await expect(send).toBeDisabled()
  await page.getByRole('checkbox').check()
  await send.click()
  await expect(page.getByRole('status')).toContainText('Successfully sent 1 notification(s)')
  await expect(send).toHaveCount(0)
  await page.getByRole('link', { name: 'View delivery history' }).click()
  const history = page.getByRole('table', { name: 'Delivery history' })
  const statuses = page.getByRole('group', { name: 'Delivery status' })
  const recipient = page.getByRole('searchbox', { name: 'Recipient email' })
  await recipient.fill('aya@example.test')
  await recipient.press('Enter')
  await expect(page).toHaveURL(/recipientEmail=aya%40example.test/)
  await statuses.getByRole('link', { name: 'Accepted', exact: true }).click()
  await expect(page).toHaveURL(/status=SENT/)
  await expect(history).toContainText('New mix: Local Frequencies')
  await expect(history).toContainText('aya@example.test')
  await expect(history).toContainText('Accepted')
  await expect(history).not.toContainText('former@example.test')
  await page.reload()
  await expect(statuses.getByRole('link', { name: 'Accepted', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await expect(recipient).toHaveValue('aya@example.test')
  await statuses.getByRole('link', { name: 'Failed', exact: true }).click()
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
  const rows = page.getByRole('table', { name: 'Delivery history' }).locator('tbody > tr.admin-row')
  const pages = page.getByRole('navigation', { name: 'Delivery history pages' })
  await expect(rows).toHaveCount(25)
  await expect(pages).toContainText('1 to 25 of 27')
  await pages.getByRole('link', { name: 'Next', exact: true }).click()
  await expect(rows).toHaveCount(2)
  await expect(page).toHaveURL(/recipientEmail=history%40example.test.*status=SENT.*offset=25/)
  await pages.getByRole('link', { name: 'Previous', exact: true }).click()
  await expect(rows).toHaveCount(25)
  await page.goto(
    '/dashboard/email-logs?recipientEmail=history%40example.test&status=SENT&dateFrom=2026-09-26&dateTo=2026-09-26',
  )
  await expect(page.getByText('2026-09-26 to 2026-09-26', { exact: true })).toBeVisible()
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('Archived announcement 26')
  await page.getByRole('link', { name: 'Clear dates', exact: true }).click()
  await expect(rows).toHaveCount(25)
  await expect(page.getByText('2026-09-26 to 2026-09-26', { exact: true })).toHaveCount(0)
})
