import { expect, test, type Page } from '@playwright/test'

const signIn = async (page: Page, email: string) => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeEnabled()
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
})

test('desktop account actions support keyboard, dismissal, navigation and sign-out', async ({
  page,
  browserName,
}) => {
  await signIn(page, 'creator@gbfm.local')
  const trigger = page.getByRole('button', { name: 'Account menu', exact: true })
  const menu = page.getByRole('navigation', { name: 'Account', exact: true })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('Local Creator')
  await expect(menu).toContainText('@local-creator')
  await expect(menu.getByRole('link', { name: 'Dashboard', exact: true })).toBeFocused()
  await expect(menu.getByRole('link', { name: 'New post', exact: true })).toHaveAttribute(
    'href',
    '/new',
  )
  await expect(menu.getByRole('link', { name: 'New mix', exact: true })).toHaveAttribute(
    'href',
    '/mix-upload',
  )
  await expect(menu.getByRole('link', { name: 'My content', exact: true })).toHaveAttribute(
    'href',
    '/dashboard/content',
  )
  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await trigger.click()
  await expect(menu).not.toBeVisible()
  await trigger.click()
  await page.locator('.account-menu-backdrop').click({ position: { x: 20, y: 20 } })
  await expect(menu).not.toBeVisible()
  await trigger.click()
  await expect(menu.getByRole('link', { name: 'Dashboard', exact: true })).toBeFocused()
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
  await expect(menu.getByRole('link', { name: 'Edit profile', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/dashboard\/profile$/)
  await expect(menu).not.toBeVisible()
  await trigger.click()
  await menu.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible()
  await expect(trigger).toHaveCount(0)
})

test('listener menu hides creator actions and respects themes and mobile navigation', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, 'listener@gbfm.local')
  const trigger = page.getByRole('button', { name: 'Account menu', exact: true })
  const menu = page.getByRole('navigation', { name: 'Account', exact: true })
  await trigger.click()
  await expect(menu).toContainText('Local Listener')
  await expect(menu.getByRole('link', { name: 'New post', exact: true })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: 'New mix', exact: true })).toHaveCount(0)
  const bounds = await menu.boundingBox()
  expect(bounds?.x).toBeGreaterThan(0)
  expect((bounds?.y ?? 800) + (bounds?.height ?? 0)).toBeLessThan(752)
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(trigger).not.toBeVisible()
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  const mobileMenu = page.getByRole('dialog', { name: 'Menu', exact: true })
  await expect(mobileMenu).toBeVisible()
  await expect(mobileMenu.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible()
})

test('anonymous desktop navigation retains the sign-in return path', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toHaveAttribute(
    'href',
    '/auth/sign-in?returnTo=%2Fprivacy',
  )
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0)
})

test('account popover blocks tweet shortcuts and closes on browser history navigation', async ({
  page,
}) => {
  await signIn(page, 'creator@gbfm.local')
  await page.goto('/tweet/e2e-archive-one')
  const trigger = page.getByRole('button', { name: 'Account menu', exact: true })
  const menu = page.getByRole('navigation', { name: 'Account', exact: true })
  await trigger.click()
  await expect(menu.getByRole('link', { name: 'Dashboard', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await page.getByRole('link', { name: 'Newer tweet', exact: true }).focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
  await trigger.click()
  await expect(menu).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  await expect(menu).not.toBeVisible()
})
