import { expect, test } from '@playwright/test'

// A browser boundary fixture exercises our lifecycle and callback contract without relying
// on Cloudflare availability. The separate real-widget test uses its official test sitekey.
const widget = `
let current;
window.turnstile = {
  render(host, options) {
    current = { host, options };
    document.documentElement.dataset.challengeRenders = String(Number(document.documentElement.dataset.challengeRenders || 0) + 1);
    host.dataset.action = options.action;
    host.dataset.appearance = options.appearance;
    for (const [label, run] of [
      ['Pass challenge', () => options.callback('fixture-token')],
      ['Fail challenge', () => options['error-callback']()],
      ['Expire challenge', () => options['expired-callback']()],
      ['Timeout challenge', () => options['timeout-callback']()]
    ]) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = label;
      button.addEventListener('click', run); host.append(button);
    }
    return 'fixture-widget';
  },
  reset() { current.options.callback('fixture-token'); },
  remove() {
    current.host.replaceChildren();
    document.documentElement.dataset.challengeRemovals = String(Number(document.documentElement.dataset.challengeRemovals || 0) + 1);
  }
};`

test('challenge callbacks gate submission, preserve details, retry and release the widget on navigation', async ({
  page,
}) => {
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: widget }),
  )
  await page.goto('/subscribe')
  const subscribe = page.getByRole('button', { name: 'Subscribe', exact: true })
  await expect(page.locator('[data-turnstile]')).toHaveAttribute(
    'data-action',
    'newsletter-subscribe',
  )
  await expect(page.locator('[data-turnstile]')).toHaveAttribute(
    'data-appearance',
    'interaction-only',
  )
  await expect(subscribe).toBeDisabled()
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('challenge@gbfm.local')
  await page.getByRole('textbox', { name: 'Name (optional)' }).fill('Challenge fixture')
  for (const callback of ['Fail challenge', 'Expire challenge', 'Timeout challenge']) {
    await page.getByRole('button', { name: 'Pass challenge', exact: true }).click()
    await expect(subscribe).toBeEnabled()
    await page.getByRole('button', { name: callback, exact: true }).click()
    await expect(subscribe).toBeDisabled()
    await expect(page.getByRole('status')).toContainText('Please retry verification')
    await page.getByRole('button', { name: 'Retry verification', exact: true }).click()
    await expect(subscribe).toBeEnabled()
  }
  await page.route('**/actions/subscribe', (route) => {
    expect(route.request().postData()).toContain('fixture-token')
    return route.fulfill({ status: 400, body: 'Verification failed' })
  })
  await subscribe.click()
  await expect(page.getByRole('status')).toContainText('Please retry verification')
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(
    'challenge@gbfm.local',
  )
  await expect(page.getByRole('textbox', { name: 'Name (optional)' })).toHaveValue(
    'Challenge fixture',
  )
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('link', { name: 'About', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-challenge-removals', '1')
  await page.goBack()
  await expect(page.locator('html')).toHaveAttribute('data-challenge-renders', '2')
  await expect(subscribe).toBeDisabled()
})

test('a blocked challenge script gives an accessible retry without losing the email', async ({
  page,
}) => {
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) =>
    route.abort(),
  )
  await page.goto('/subscribe')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('blocked@gbfm.local')
  await expect(page.getByRole('status')).toContainText('Please retry verification')
  await expect(page.getByRole('button', { name: 'Subscribe', exact: true })).toBeDisabled()
  await page.unroute('https://challenges.cloudflare.com/turnstile/v0/api.js*')
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: widget }),
  )
  await page.getByRole('button', { name: 'Retry verification', exact: true }).click()
  await page.getByRole('button', { name: 'Pass challenge', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Subscribe', exact: true })).toBeEnabled()
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(
    'blocked@gbfm.local',
  )
})

test('official Turnstile test widget subscribes through the server action and local API', async ({
  page,
}) => {
  await page.goto('/subscribe')
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`turnstile-${Date.now()}@gbfm.local`)
  await expect(page.getByRole('button', { name: 'Subscribe', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText("You're subscribed.")
})

test('account signup uses its own challenge action and preserves entered fields after rejection', async ({
  page,
}) => {
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: widget }),
  )
  await page.goto('/auth/sign-up')
  await expect(page.locator('[data-turnstile]')).toHaveAttribute('data-action', 'account-signup')
  const signup = page.getByRole('button', { name: 'Sign up', exact: true })
  await expect(signup).toBeDisabled()
  await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('Signup fixture')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('signup@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Pass challenge', exact: true }).click()
  await page.route('**/auth/sign-up', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 403, body: 'Invalid verification' })
      : route.continue(),
  )
  await signup.click()
  await expect(page.getByRole('status')).toContainText('Please retry verification')
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(
    'signup@gbfm.local',
  )
  await expect(page.getByRole('textbox', { name: 'Password', exact: true })).toHaveValue(
    'LocalTest123!',
  )
  await page.getByRole('button', { name: 'Retry verification', exact: true }).click()
  await expect(signup).toBeEnabled()
  await expect(signup).toHaveAttribute('aria-busy', 'false')
})

test('signup without JavaScript explains the requirement; sign-in remains available', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('/auth/sign-up')
    await expect(page.getByRole('button', { name: 'Sign up', exact: true })).toBeDisabled()
    await expect(
      page.getByText('JavaScript is required to verify your browser and submit this form.', {
        exact: false,
      }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
    await expect(page.locator('[data-turnstile]')).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('official Turnstile test widget creates an account through the API and sets the session', async ({
  page,
}) => {
  await page.goto('/auth/sign-up?returnTo=%2Fabout')
  await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('Signup fixture')
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`signup-${crypto.randomUUID()}@gbfm.local`)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await expect(page.getByRole('button', { name: 'Sign up', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()
  await expect(page).toHaveURL(/\/about$/)
  const session = await page.request.get('/auth/get-session')
  expect(await session.json()).toMatchObject({ user: { name: 'Signup fixture' } })
})
