import { expect, test } from '@playwright/test'

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
]) {
  test(`${viewport.name} episode controls stay visible and support play/pause`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/shows/e2e-local-radio')

    const control = page.getByRole('button', {
      name: 'Play episode 1: Local Frequencies',
      exact: true,
    })

    await expect(control).toBeEnabled()
    const icon = control.locator('.episode-play-icon')
    await expect(icon).toHaveCSS('opacity', '1')
    await expect(icon).toHaveCSS('width', '44px')
    await expect(icon).toHaveCSS('height', '44px')
    await expect(control.locator('.episode-play-number')).toHaveText('001')

    const pageWidth = await page.evaluate(() => ({
      viewport: innerWidth,
      content: document.documentElement.scrollWidth,
    }))

    expect(pageWidth.content).toBeLessThanOrEqual(pageWidth.viewport)
    await control.click()
    const player = page.getByRole('dialog', { name: 'Now playing', exact: true })
    await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    await player.getByRole('button', { name: 'Collapse player' }).click()

    const pause = page.getByRole('button', {
      name: 'Pause episode 1: Local Frequencies',
      exact: true,
    })

    await expect(pause).toHaveAttribute('aria-pressed', 'true')
    await pause.click()
    await expect(control).toHaveAttribute('aria-pressed', 'false')
    await expect(icon).toHaveCSS('opacity', '1')

    const mini = page.getByRole('region', { name: 'Mini player', exact: true })
    await expect(mini).toBeVisible()
    await expect(mini).toContainText('Local Frequencies')
    await expect(page.locator('.show-compact')).not.toBeVisible()
    const navigation = page.getByRole('navigation', { name: 'Primary', exact: true })
    await expect(navigation.getByRole('link', { name: 'Mixes', exact: true })).toBeVisible()
    await expect(mini.getByRole('button', { name: 'Play', exact: true })).toHaveCSS('width', '44px')
    await mini.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(pause).toHaveAttribute('aria-pressed', 'true')
    await mini.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(control).toHaveAttribute('aria-pressed', 'false')
    await mini.getByRole('button', { name: 'Now playing', exact: true }).click()
    await expect(player).toBeVisible()
    await player.getByRole('button', { name: 'Collapse player' }).click()
    await expect(player).not.toBeVisible()
    await page.reload()
    await expect(mini).toContainText('Local Frequencies')
    await expect(mini.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  })
}

test('desktop retains episode numbers and reveals playback on keyboard focus', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    hasTouch: false,
    isMobile: false,
  })

  const page = await context.newPage()
  await page.goto(
    `${process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'}/shows/e2e-local-radio`,
  )

  const control = page.getByRole('button', {
    name: 'Play episode 1: Local Frequencies',
    exact: true,
  })

  await expect(control).toBeEnabled()
  await page.mouse.move(0, 0)
  await expect(control.locator('.episode-play-number')).toHaveCSS('font-size', '36px')
  await expect(control.locator('.episode-play-icon')).toHaveCSS('opacity', '0')
  await control.focus()
  await expect(control.locator('.episode-play-icon')).toHaveCSS('opacity', '1')
  await context.close()
})
