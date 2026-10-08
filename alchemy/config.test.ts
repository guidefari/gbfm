import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { deploymentConfig, IncompleteSecretsError } from './config'

const requiredSecrets = [
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SENTRY_BACKEND_DSN',
  'VITE_PUBLIC_SENTRY_DSN',
  'BETTER_AUTH_SECRET',
  'CLOUDFLARE_ANALYTICS_API_TOKEN',
  'StorageRegion',
  'StorageAccessKeyId',
  'StorageSecretAccessKey',
]

describe('deploymentConfig', () => {
  beforeEach(() => {
    for (const name of requiredSecrets) vi.stubEnv(name, 'test-value')
    vi.stubEnv('ADMIN_EMAIL', 'admin@example.com')
  })

  afterEach(() => vi.unstubAllEnvs())

  test.each([undefined, '', ' \t\n '])('rejects a blank admin email (%j)', (value) => {
    vi.stubEnv('ADMIN_EMAIL', value)

    const exit = Effect.runSyncExit(deploymentConfig(false))
    expect(Exit.isFailure(exit)).toBe(true)

    if (!Exit.isFailure(exit)) throw new Error('Expected deployment configuration to fail')

    const defect = exit.cause.reasons.find(Cause.isDieReason)
    expect(defect?.defect).toBeInstanceOf(IncompleteSecretsError)
    expect(defect?.defect).toEqual(new IncompleteSecretsError(['ADMIN_EMAIL']))
  })

  test('reports missing admin email alongside missing secrets', () => {
    vi.stubEnv('ADMIN_EMAIL', undefined)
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', '')

    const exit = Effect.runSyncExit(deploymentConfig(false))

    if (!Exit.isFailure(exit)) throw new Error('Expected deployment configuration to fail')

    const defect = exit.cause.reasons.find(Cause.isDieReason)
    expect(defect?.defect).toEqual(
      new IncompleteSecretsError(['SpotifyClientSecret (SPOTIFY_CLIENT_SECRET)', 'ADMIN_EMAIL']),
    )
  })

  test('keeps admin email as a plain environment value outside the Secret resources', () => {
    vi.stubEnv('ADMIN_EMAIL', ' admin@example.com ')

    const config = Effect.runSync(deploymentConfig(false))
    expect(config.adminEmail).toBe(' admin@example.com ')
    expect(config.secrets).not.toHaveProperty('ADMIN_EMAIL')
    expect(config.secrets).not.toHaveProperty('adminEmail')
  })

  test('allows local dev without admin email or secrets', () => {
    for (const name of requiredSecrets) vi.stubEnv(name, undefined)
    vi.stubEnv('ADMIN_EMAIL', undefined)

    const config = Effect.runSync(deploymentConfig(true))
    expect(config.adminEmail).toBe('')
    expect(Object.values(config.secrets).every((value) => value === '')).toBe(true)
  })
})
