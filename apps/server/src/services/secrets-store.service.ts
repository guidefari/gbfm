import * as Effect from 'effect/Effect'
import type { SecretsStoreSecret } from '@cloudflare/workers-types'
import { ConfigServiceError, getErrorMessage } from '@/errors'
import { secretBindingNames, type WorkerConfigBindings } from '@/services/config.service'

type SecretName = (typeof secretBindingNames)[number]

/**
 * A secret arrives either as a Secrets Store handle or, on a stage that has
 * not migrated yet, as the plain string Alchemy injected at deploy time.
 */
export type SecretBinding = SecretsStoreSecret | string | undefined

export type SecretsStoreBindings = Readonly<Partial<Record<SecretName, SecretBinding>>>

const isStoreHandle = (binding: SecretBinding): binding is SecretsStoreSecret =>
  binding instanceof Object && 'get' in binding

const readOne = (name: SecretName, binding: SecretsStoreSecret) =>
  Effect.tryPromise({
    try: () => binding.get(),
    catch: (cause) =>
      new ConfigServiceError({
        message: `Failed to read secret ${name} from the Secrets Store: ${getErrorMessage(cause)}`,
        operation: 'readSecret',
        configKey: name
      })
  })

/**
 * Resolves Secrets Store bindings into the plain-string shape createConfig
 * expects. Cloudflare exposes each secret as an async handle rather than an
 * env string, so the values cannot be read during module evaluation; this
 * runs once per isolate when the config layer is built.
 */
export const resolveSecretBindings = (
  env: SecretsStoreBindings
): Effect.Effect<Partial<WorkerConfigBindings>, ConfigServiceError> =>
  Effect.forEach(
    secretBindingNames,
    (name) => {
      const binding = env[name]
      return isStoreHandle(binding)
        ? readOne(name, binding).pipe(Effect.map((value) => [name, value] as const))
        : Effect.succeed([name, binding] as const)
    },
    { concurrency: 'unbounded' }
  ).pipe(Effect.map(Object.fromEntries))
