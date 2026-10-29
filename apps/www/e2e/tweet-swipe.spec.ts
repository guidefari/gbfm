import { expect, test, type Page } from '@playwright/test'

const ready = async (page: Page, slug: string) => {
  await expect(page.locator('.site')).toHaveAttribute('data-interactive', 'true')
  await expect(page.locator('[data-tweet-swipe]')).toHaveAttribute('data-tweet-swipe', slug)
  await expect(page.locator('[data-tweet-swipe]')).toHaveAttribute('data-swipe-ready', 'true')
}

const touchSwipe = (page: Page, selector: string, dx: number, dy = 0, originX = 150) =>
  page.evaluate(
    ({ selector, dx, dy, originX }) => {
      const target = document.querySelector(selector)

      if (!target) throw new Error('Missing gesture target')

      const y = target.getBoundingClientRect().top + 10
      const touch = (x: number, y: number) => ({ identifier: 1, target, clientX: x, clientY: y })
      const first = touch(originX, y)
      const last = touch(originX + dx, y + dy)

      for (const [name, touches, changedTouches] of [
        ['touchstart', [first], [first]],
        ['touchmove', [last], [last]],
        ['touchend', [], [last]],
      ] as const) {
        const event = new Event(name, { bubbles: true, cancelable: true })
        Object.defineProperties(event, {
          touches: { value: touches },
          changedTouches: { value: changedTouches },
        })
        target.dispatchEvent(event)
      }
    },
    { selector, dx, dy, originX },
  )

test('touch adapter browses newer and older while preserving keyboard and visible alternatives', async ({
  page,
}) => {
  await page.goto('/tweet/e2e-archive-one')
  await ready(page, 'e2e-archive-one')
  await touchSwipe(page, 'article', 100)
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
  await ready(page, 'e2e-archive-two')
  await touchSwipe(page, 'article', -100)
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  await ready(page, 'e2e-archive-one')
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
  await page.locator('summary[aria-label="Reading options"]').click()
  await expect(page.getByRole('link', { name: 'Older tweet', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Older tweet', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
})

test('links, vertical gestures, edge gestures, and open reading options never trigger tweet navigation', async ({
  page,
}) => {
  await page.goto('/tweet/e2e-archive-one')
  await ready(page, 'e2e-archive-one')
  const path = page.url()
  await touchSwipe(page, 'article a', 100)
  await expect(page).toHaveURL(path)
  await touchSwipe(page, 'article', 100, 120)
  await expect(page).toHaveURL(path)
  await touchSwipe(page, 'article', 100, 0, 16)
  await expect(page).toHaveURL(path)
  await page.locator('summary[aria-label="Reading options"]').click()
  await touchSwipe(page, 'article', 100)
  await expect(page).toHaveURL(path)
})

test('trusted Chromium touch input navigates in both directions', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Trusted touch dispatch uses Chromium CDP; the DOM adapter checks also run in WebKit.',
  )
  await page.goto('/tweet/e2e-archive-one')
  await ready(page, 'e2e-archive-one')
  const cdp = await context.newCDPSession(page)

  const swipe = async (from: number, to: number) => {
    const bounds = await page.locator('article').boundingBox()

    if (!bounds) throw new Error('Missing article bounds')

    const y = bounds.y + bounds.height - 60
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: from, y }],
    })

    for (const fraction of [0.25, 0.5, 0.75, 1])
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: from + (to - from) * fraction, y }],
      })

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }

  await swipe(100, 240)
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
  await ready(page, 'e2e-archive-two')
  await swipe(240, 100)
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  await cdp.detach()
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
]) {
  test(`reader controls follow shared geometry at ${viewport.width}px without fixed reader chrome`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/tweet/e2e-archive-one')
    await ready(page, 'e2e-archive-one')
    const options = page.locator('summary[aria-label="Reading options"]')
    await expect(options).toHaveCSS('border-radius', '4px')
    await expect(options).toHaveCSS('min-height', '44px')
    await expect(page.locator('.tweet-reader-navigation')).toHaveCSS('position', 'relative')
    await options.click()
    await expect(page.locator('.tweet-reader-options')).toHaveCSS('border-radius', '12px')
    const button = page.getByRole('link', { name: 'Newer tweet', exact: true })
    await expect(button).toHaveCSS('border-radius', '4px')
    await expect(button).toHaveCSS('font-size', '14px')
    const bounds = await page.locator('.tweet-reader-options').boundingBox()

    if (!bounds) throw new Error('Missing reading options bounds')

    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    )
  })
}

for (const theme of ['light', 'dark']) {
  test(`manual ${theme} theme keeps tweet prose at the semantic foreground color`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.addInitScript((theme) => localStorage.setItem('vite-ui-theme', theme), theme)
    await page.goto('/tweet/e2e-archive-one')
    await ready(page, 'e2e-archive-one')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

    const foreground = await page
      .locator('[data-tweet-swipe]')
      .evaluate((element) => getComputedStyle(element).color)

    await expect(page.locator('article .prose')).toHaveCSS('color', foreground)
    await expect(page.locator('article .prose p')).toHaveCSS('color', foreground)
  })
}
