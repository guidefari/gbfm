import { expect, test } from '@playwright/test'

test('player slides as one opaque panel and releases scroll locking after collapse', async ({
  page,
}) => {
  await page.goto('/mixes')

  const play = page
    .getByRole('article')
    .filter({ hasText: 'Local Frequencies' })
    .getByRole('button', { name: 'Play', exact: true })

  await expect(play).toBeEnabled()

  const frames = await play.evaluate(async (button) => {
    const frames: Array<{ top: number; height: number; opacity: string }> = []

    if (!(button instanceof HTMLElement)) throw new Error('Expected a player button')
    button.click()
    const started = performance.now()

    while (performance.now() - started < 800) {
      await new Promise(requestAnimationFrame)
      const panel = document.querySelector('#fullscreen-player-panel')

      if (panel) {
        const bounds = panel.getBoundingClientRect()
        frames.push({
          top: bounds.top,
          height: bounds.height,
          opacity: getComputedStyle(panel).opacity,
        })
      }
    }

    return frames
  })

  expect(frames.length).toBeGreaterThan(2)
  expect(frames[0].top).toBeGreaterThan(frames[0].height * 0.8)
  expect(frames.some((frame) => frame.top > 10 && frame.top < frame.height * 0.8)).toBe(true)
  expect(frames.at(-1)?.top).toBeCloseTo(0)
  expect(frames.every((frame) => frame.opacity === '1')).toBe(true)

  for (let index = 1; index < frames.length; index++) {
    expect(frames[index].top).toBeLessThanOrEqual(frames[index - 1].top + 1)
  }

  const player = page.getByRole('dialog', { name: 'Now playing', exact: true })
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()

  const exitFrames = await player
    .getByRole('button', { name: 'Collapse player', exact: true })
    .evaluate(async (button) => {
      const positions: Array<number> = []

      if (!(button instanceof HTMLElement)) throw new Error('Expected a player button')
      button.click()
      const started = performance.now()

      while (performance.now() - started < 600) {
        await new Promise(requestAnimationFrame)
        const panel = document.querySelector('#fullscreen-player-panel')

        if (panel) positions.push(panel.getBoundingClientRect().top)
      }

      return positions
    })

  expect(exitFrames.some((top) => top > 10)).toBe(true)
  await expect(player).not.toBeVisible()
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .not.toBe('hidden')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Now playing', exact: true }).click()
  await expect(player).toBeVisible()
  await expect
    .poll(() =>
      page
        .locator('#fullscreen-player-panel')
        .evaluate((element) => getComputedStyle(element).transitionDuration),
    )
    .toBe('0s')
  await player.getByRole('button', { name: 'Collapse player', exact: true }).click()
  await expect(player).not.toBeVisible()
})
