import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { expect, test } from 'vitest'

import { makeSpotifyEffectRunner } from './runtime'

test('builds its context lazily and reuses it for later effects', async () => {
  let builds = 0

  const run = makeSpotifyEffectRunner(async () => {
    builds += 1

    return Context.empty()
  })

  expect(builds).toBe(0)
  await expect(run(Effect.succeed('first'))).resolves.toBe('first')
  await expect(run(Effect.succeed('second'))).resolves.toBe('second')
  expect(builds).toBe(1)
})

test('retries initialization after a failed context build', async () => {
  let shouldFail = true

  const run = makeSpotifyEffectRunner(async () => {
    if (shouldFail) throw new Error('context build failed')

    return Context.empty()
  })

  await expect(run(Effect.succeed('first attempt'))).rejects.toThrow('context build failed')

  shouldFail = false
  await expect(run(Effect.succeed('second attempt'))).resolves.toBe('second attempt')
})
