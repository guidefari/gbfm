import { expect, test } from '@playwright/test'

test('mobile menu contains scrolling and restores the page after dismissal and navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await page.goto('/privacy')
  const trigger = page.getByRole('button', { name: 'Menu', exact: true })
  const sheet = page.locator('.menu-sheet')
  const links = page.locator('.menu-sheet-links')
  await expect(trigger).toBeEnabled()
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(sheet).toBeVisible()
  await expect(sheet).not.toHaveAttribute('data-transition')
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .toBe('hidden')
  const bounds = await sheet.boundingBox()
  expect(bounds?.y).toBeGreaterThanOrEqual(16)
  expect((bounds?.y ?? 600) + (bounds?.height ?? 0)).toBeLessThanOrEqual(600)
  expect(await links.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await links.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(sheet.getByRole('link', { name: 'Log in', exact: true })).toBeInViewport()
  await page.keyboard.press('Escape')
  await expect(sheet).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .not.toBe('hidden')
  await trigger.click()
  await expect(sheet).toBeVisible()
  await page.mouse.click(195, 8)
  await expect(page.locator('#mobile-menu')).not.toBeVisible()
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .not.toBe('hidden')
  await trigger.click()
  await sheet.getByRole('link', { name: 'Tweets', exact: true }).click()
  await expect(page).toHaveURL(/\/tweets$/)
  await expect(sheet).not.toBeVisible()
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .not.toBe('hidden')
})

test('mobile menu slides up with the player timing and respects reduced motion', async ({
  page,
}) => {
  await page.goto('/privacy')
  const trigger = page.getByRole('button', { name: 'Menu', exact: true })
  await expect(trigger).toBeEnabled()

  const frames = await trigger.evaluate(async (button) => {
    if (!(button instanceof HTMLElement)) throw new Error('Expected the menu button')

    const frames: Array<{
      top: number
      height: number
      viewport: number
      duration: string
      easing: string
    }> = []

    button.click()
    const started = performance.now()

    while (performance.now() - started < 800) {
      await new Promise(requestAnimationFrame)
      const sheet = document.querySelector('.menu-sheet')

      if (sheet) {
        const bounds = sheet.getBoundingClientRect()
        const style = getComputedStyle(sheet)
        frames.push({
          top: bounds.top,
          height: bounds.height,
          viewport: innerHeight,
          duration: style.transitionDuration,
          easing: style.transitionTimingFunction,
        })
      }
    }

    return frames
  })

  expect(frames.length).toBeGreaterThan(2)
  expect(frames[0].top).toBeGreaterThanOrEqual(frames[0].viewport - 2)
  expect(frames.at(-1)?.top).toBeCloseTo(frames[0].viewport - frames[0].height)
  expect(frames[0].duration).toBe('0.36s')
  expect(frames[0].easing).toBe('cubic-bezier(0.22, 1, 0.36, 1)')

  for (let index = 1; index < frames.length; index++)
    expect(frames[index].top).toBeLessThanOrEqual(frames[index - 1].top + 1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Menu', exact: true })).not.toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await trigger.click()
  const sheet = page.locator('.menu-sheet')
  await expect(sheet).toBeVisible()
  expect(await sheet.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s')
  await page.getByRole('button', { name: 'Close menu', exact: true }).click()
  await expect(sheet).not.toBeVisible()
})
