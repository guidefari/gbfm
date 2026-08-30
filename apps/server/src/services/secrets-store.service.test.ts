import { describe, expect, it } from 'vitest'
import * as Effect from 'effect/Effect'
import { resolveSecretBindings } from './secrets-store.service'

class FakeStoreSecret {
  constructor(private readonly value: string) {}
  get() {
    return Promise.resolve(this.value)
  }
}

describe('resolveSecretBindings', () => {
  it('reads a value from a Secrets Store handle', async () => {
    const resolved = await Effect.runPromise(
      resolveSecretBindings({ BETTER_AUTH_SECRET: new FakeStoreSecret('from-store') })
    )

    expect(resolved.BETTER_AUTH_SECRET).toBe('from-store')
  })

  it('passes through a plain string binding unchanged', async () => {
    const resolved = await Effect.runPromise(
      resolveSecretBindings({ BETTER_AUTH_SECRET: 'from-env' })
    )

    expect(resolved.BETTER_AUTH_SECRET).toBe('from-env')
  })

  it('fails when a store read rejects rather than yielding a blank secret', async () => {
    const failing = {
      get: () => Promise.reject(new Error('store unavailable'))
    }

    const error = await Effect.runPromise(
      Effect.flip(resolveSecretBindings({ BETTER_AUTH_SECRET: failing }))
    )

    expect(error.configKey).toBe('BETTER_AUTH_SECRET')
  })
})
