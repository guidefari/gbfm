import * as Effect from 'effect/Effect'

const secretSources = {
  SpotifyClientId: 'SPOTIFY_CLIENT_ID',
  SpotifyClientSecret: 'SPOTIFY_CLIENT_SECRET',
  SENTRY_BACKEND_DSN: 'SENTRY_BACKEND_DSN',
  VITE_PUBLIC_SENTRY_DSN: 'VITE_PUBLIC_SENTRY_DSN',
  BETTER_AUTH_SECRET: 'BETTER_AUTH_SECRET',
  GBFM_ENCRYPTION_ROOT_KEY: 'GBFM_ENCRYPTION_ROOT_KEY',
  StorageRegion: 'StorageRegion',
  StorageAccessKeyId: 'StorageAccessKeyId',
  StorageSecretAccessKey: 'StorageSecretAccessKey'
} as const

export type SecretName = keyof typeof secretSources
export type SecretValues = Readonly<Record<SecretName, string>>

export interface WebsiteConfig {
  readonly spotifyClientId: string
  readonly sentryDsn: string
  readonly sentryRelease: string
}

export interface DeploymentConfig {
  readonly secrets: SecretValues
  readonly website: WebsiteConfig
  readonly adminEmail: string
  readonly emailTestRecipient: string | undefined
}

export class IncompleteSecretsError extends Error {
  constructor(missing: ReadonlyArray<string>) {
    super(
      `Refusing to deploy without ${missing.length} secret(s): ${missing.join(', ')}. ` +
        `Alchemy patches any secret whose value differs from its state, so ` +
        `deploying these blank would overwrite the stored value with an empty ` +
        `string. Populate the environment before deploying.`
    )
  }
}

const read = (name: string) => process.env[name] ?? ''

export const deploymentConfig = (isLocalDev: boolean) =>
  Effect.gen(function* () {
    if (!isLocalDev) {
      const missing = Object.entries(secretSources)
        .filter(([, source]) => read(source).trim().length === 0)
        .map(([name, source]) => `${name} (${source})`)

      if (missing.length > 0) return yield* Effect.die(new IncompleteSecretsError(missing))
    }

    const spotifyClientId = read(secretSources.SpotifyClientId)
    const sentryDsn = read(secretSources.VITE_PUBLIC_SENTRY_DSN)

    return {
      secrets: {
        SpotifyClientId: spotifyClientId,
        SpotifyClientSecret: read(secretSources.SpotifyClientSecret),
        SENTRY_BACKEND_DSN: read(secretSources.SENTRY_BACKEND_DSN),
        VITE_PUBLIC_SENTRY_DSN: sentryDsn,
        BETTER_AUTH_SECRET: read(secretSources.BETTER_AUTH_SECRET),
        GBFM_ENCRYPTION_ROOT_KEY: read(secretSources.GBFM_ENCRYPTION_ROOT_KEY),
        StorageRegion: read(secretSources.StorageRegion),
        StorageAccessKeyId: read(secretSources.StorageAccessKeyId),
        StorageSecretAccessKey: read(secretSources.StorageSecretAccessKey)
      },
      website: {
        spotifyClientId,
        sentryDsn,
        sentryRelease: read('SENTRY_RELEASE')
      },
      adminEmail: read('ADMIN_EMAIL'),
      emailTestRecipient: process.env.EMAIL_TEST_RECIPIENT
    } satisfies DeploymentConfig
  })
