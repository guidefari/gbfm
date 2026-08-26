import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import * as Redacted from 'effect/Redacted'

/**
 * Secrets the Worker reads from the Cloudflare Secrets Store, mapped to the
 * environment variable each is seeded from.
 *
 * Alchemy compares a secret's value against its own state, so a deploy whose
 * values match what is stored is a no-op and never contacts Cloudflare. The
 * value is still a required resource input, though: it cannot be omitted to
 * mean "keep what is stored". A deploy therefore needs every variable present,
 * and `assertComplete` fails loudly rather than letting a missing one reach
 * Cloudflare as an empty string and wipe the stored secret.
 */
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

const missingSources = () =>
  Object.entries(secretSources)
    .filter(([, sourceName]) => (process.env[sourceName] ?? '').trim().length === 0)
    .map(([name, sourceName]) => `${name} (${sourceName})`)

/**
 * Creates the account's Secrets Store and every secret in it.
 *
 * Cloudflare allows one store per account, so names are stage-scoped to keep
 * prod and staging from overwriting each other.
 *
 * `alchemy dev` runs Workers under local Miniflare, which rejects
 * `secrets_store_secret` bindings outright (unsupported in local mode).
 * Local dev therefore skips the Secrets Store entirely and binds each value
 * as `secret_text` instead — a plain `Redacted<string>`, sourced from the
 * same `.env`-backed `process.env` Bun already loads. The Worker-side reader
 * (`resolveSecretBindings`) already falls back to treating a non-store
 * binding as the resolved string, so no runtime code needed to change.
 */
export const secretsStore = (apiUrl: string, isLocalDev: boolean) =>
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack

    // The blank-write guard only protects the real Secrets Store from
    // getting overwritten with empty strings; dev never touches Cloudflare,
    // so an incomplete `.env` is fine there and every unset value just
    // resolves to `''`.
    if (!isLocalDev) {
      const missing = missingSources()
      if (missing.length > 0) return yield* Effect.die(new IncompleteSecretsError(missing))
    }

    // Derived from the stack rather than the environment. Better Auth builds
    // emailed links from this, so a stale inherited value sends real users to
    // whichever host it last named: production's pointed at a staging Worker.
    const sources = {
      ...Object.fromEntries(
        Object.entries(secretSources).map(([name, source]) => [name, process.env[source] ?? ''])
      ),
      BETTER_AUTH_URL: apiUrl
    } satisfies Record<string, string>

    if (isLocalDev) {
      return Object.fromEntries(
        Object.entries(sources).map(([name, value]) => [name, Redacted.make(value)])
      )
    }

    const store = yield* Cloudflare.SecretsStore.Store('Secrets')

    const entries = yield* Effect.forEach(
      Object.entries(sources),
      ([name, value]) =>
        Cloudflare.SecretsStore.Secret(`Secret${name}`, {
          store,
          name: `${stack.stage}-${name}`,
          value: Redacted.make(value)
        }).pipe(Effect.map((secret) => [name, secret] as const)),
      { concurrency: 4 }
    )

    return Object.fromEntries(entries)
  })

export type SecretBindings = Effect.Success<ReturnType<typeof secretsStore>>
