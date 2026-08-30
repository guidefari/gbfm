import { Context, Effect, Layer, Redacted, Schema } from 'effect'

const secretNames = [
  'SpotifyClientId',
  'SpotifyClientSecret',
  'SENTRY_BACKEND_DSN',
  'VITE_PUBLIC_SENTRY_DSN',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_EXPORTER_OTLP_HEADERS',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'GBFM_ENCRYPTION_ROOT_KEY',
  'StorageProvider',
  'StorageEndpoint',
  'StorageRegion',
  'StorageAccessKeyId',
  'StorageSecretAccessKey',
  'StorageSigningEndpoint'
] as const

type SecretName = (typeof secretNames)[number]

export const secretBindingNames = secretNames

// The aws provider resolves credentials from the ECS instance role, so these
// are legitimately blank in production.
const optionalSecretNames = [
  // Derived from whether an R2 account ID is bound, so it is never set directly.
  'StorageProvider',
  'StorageEndpoint',
  'StorageAccessKeyId',
  'StorageSecretAccessKey',
  'StorageSigningEndpoint',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_EXPORTER_OTLP_HEADERS'
] as const satisfies readonly SecretName[]

type OptionalSecretName = (typeof optionalSecretNames)[number]

// The optional names are genuinely absent from a D1 deployment's bindings, not
// merely undefined, so they must not be required keys.
export type WorkerConfigBindings = Readonly<
  Record<Exclude<SecretName, OptionalSecretName>, string | undefined> &
    Partial<Record<OptionalSecretName, string>> & {
      APP_STAGE: string
      CDN_ROUTER_URL?: string
      R2AccountId?: string
      USER_CONTENT_BUCKET_NAME: string
      MIXES_BUCKET_NAME: string
      SENTRY_ENVIRONMENT?: string
      ADMIN_EMAIL?: string
      EMAIL_SENDER?: string
    }
>

function stringValue(value: string | undefined, fallback: string): string {
  if (value !== undefined && value.length > 0) return value
  return fallback
}

function secretValue(
  name: SecretName,
  bindings: WorkerConfigBindings | undefined
): string | undefined {
  return bindings?.[name]
}

function secretString(
  name: SecretName,
  fallback: string,
  bindings: WorkerConfigBindings | undefined
): string {
  return stringValue(secretValue(name, bindings), fallback)
}

function r2AccountId(endpoint: string): string | undefined {
  try {
    const hostname = new URL(endpoint).hostname
    const suffix = '.r2.cloudflarestorage.com'
    if (!hostname.endsWith(suffix)) return undefined
    const accountId = hostname.slice(0, -suffix.length)
    return accountId || undefined
  } catch {
    return undefined
  }
}

/** Parsed object storage configuration. R2 requires an account ID; signing checks credentials at use. */
const FullEmailAddress = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
)

export const StorageConfigSchema = Schema.Struct({
  provider: Schema.Literals(['aws', 'r2']),
  accountId: Schema.optional(Schema.String),
  endpoint: Schema.optional(Schema.String),
  region: Schema.String,
  accessKeyId: Schema.optional(Schema.Redacted(Schema.String)),
  secretAccessKey: Schema.optional(Schema.Redacted(Schema.String)),
  signingEndpoint: Schema.optional(Schema.String)
}).check(
  Schema.makeFilter((storage) =>
    storage.provider === 'aws' || storage.accountId !== undefined
      ? undefined
      : 'r2 provider requires an account ID'
  )
)

const ConfigSchema = Schema.Struct({
  urls: Schema.Struct({
    frontend: Schema.String,
    vps: Schema.String,
    bucketRouter: Schema.String
  }),
  auth: Schema.Struct({
    emailSender: FullEmailAddress,
    accessTokenSecret: Schema.String,
    refreshTokenSecret: Schema.String,
    betterAuthSecret: Schema.String,
    betterAuthUrl: Schema.String
  }),
  encryption: Schema.Struct({
    rootKey: Schema.String
  }),
  spotify: Schema.Struct({
    clientId: Schema.String,
    clientSecret: Schema.String
  }),
  buckets: Schema.Struct({
    userContent: Schema.String,
    mixes: Schema.String
  }),
  storage: StorageConfigSchema,
  resources: Schema.Struct({
    available: Schema.Boolean
  }),
  app: Schema.Struct({
    stage: Schema.String,
    nodeEnv: Schema.String,
    dbStage: Schema.optional(Schema.String),
    logLevel: Schema.optional(Schema.String)
  }),
  otel: Schema.Struct({
    endpoint: Schema.optional(Schema.String),
    headers: Schema.optional(Schema.String)
  }),
  sentry: Schema.Struct({
    dsn: Schema.String,
    environment: Schema.String
  }),
  adminEmail: Schema.String
})

type ConfigSchemaType = typeof ConfigSchema.Type
export interface ConfigService extends ConfigSchemaType {}

export const ConfigService = Context.Service<ConfigService>('ConfigService')

function requiredInProduction(isProd: boolean, bindings: WorkerConfigBindings | undefined): void {
  if (!isProd) return

  const optional: readonly string[] = optionalSecretNames
  const missing = secretNames.filter(
    (name) =>
      !optional.includes(name) && stringValue(secretValue(name, bindings), '').trim().length === 0
  )
  if (missing.length > 0) {
    throw new Error(`Missing required production secrets: ${missing.join(', ')}`)
  }
}

export function createConfig(bindings?: WorkerConfigBindings): ConfigService {
  const appStage = bindings?.APP_STAGE ?? 'dev'
  const isProd = appStage === 'prod'

  const secrets = {
    SpotifyClientId: secretString('SpotifyClientId', '', bindings),
    SpotifyClientSecret: secretString('SpotifyClientSecret', '', bindings),
    SENTRY_BACKEND_DSN: secretString('SENTRY_BACKEND_DSN', '', bindings),
    VITE_PUBLIC_SENTRY_DSN: secretString('VITE_PUBLIC_SENTRY_DSN', '', bindings),
    OTEL_EXPORTER_OTLP_ENDPOINT: secretString('OTEL_EXPORTER_OTLP_ENDPOINT', '', bindings),
    OTEL_EXPORTER_OTLP_HEADERS: secretString('OTEL_EXPORTER_OTLP_HEADERS', '', bindings),
    BETTER_AUTH_SECRET: secretString('BETTER_AUTH_SECRET', '', bindings),
    BETTER_AUTH_URL: secretString('BETTER_AUTH_URL', '', bindings),
    GBFM_ENCRYPTION_ROOT_KEY: secretString(
      'GBFM_ENCRYPTION_ROOT_KEY',
      'local-development-encryption-key',
      bindings
    ),
    StorageProvider: secretString('StorageProvider', '', bindings),
    StorageEndpoint: secretString('StorageEndpoint', '', bindings),
    StorageRegion: secretString('StorageRegion', 'auto', bindings),
    StorageAccessKeyId: secretString('StorageAccessKeyId', '', bindings),
    StorageSecretAccessKey: secretString('StorageSecretAccessKey', '', bindings),
    StorageSigningEndpoint: secretString('StorageSigningEndpoint', '', bindings)
  }

  requiredInProduction(isProd, bindings)

  const frontendUrl = 'http://127.0.0.1:5173'
  const vpsUrl = 'http://127.0.0.1:3003'
  // Production serves the CDN router on its own domain. Every other stage gets
  // a generated workers.dev URL instead, so the deployed router is bound as
  // CDN_ROUTER_URL rather than assumed: pointing a non-prod stage at the
  // production domain would hand out URLs for objects written to that stage's
  // own bucket, which the production router does not serve.
  const bucketRouterUrl = isProd
    ? 'https://cdn.goosebumps.fm'
    : stringValue(bindings?.CDN_ROUTER_URL, 'https://cdn.goosebumps.fm')
  const emailSender = stringValue(bindings?.EMAIL_SENDER, 'noreply@mail.goosebumps.fm')
  const userContentBucketName = bindings?.USER_CONTENT_BUCKET_NAME ?? 'user-content-dev'
  const mixesBucketName = bindings?.MIXES_BUCKET_NAME ?? 'mixes-dev'
  const accountId = bindings?.R2AccountId ?? r2AccountId(secrets.StorageEndpoint)
  const storage = Schema.decodeUnknownSync(StorageConfigSchema)({
    // r2 is the deployment target, so an account ID is enough to select it.
    // Without one there is nothing to address a bucket with, and the aws
    // provider's instance-role credentials are the only thing left that works.
    provider: secrets.StorageProvider || (accountId === undefined ? 'aws' : 'r2'),
    accountId,
    endpoint: secrets.StorageEndpoint || undefined,
    region: secrets.StorageRegion,
    accessKeyId:
      secrets.StorageAccessKeyId.length === 0
        ? undefined
        : Redacted.make(secrets.StorageAccessKeyId),
    secretAccessKey:
      secrets.StorageSecretAccessKey.length === 0
        ? undefined
        : Redacted.make(secrets.StorageSecretAccessKey),
    signingEndpoint: secrets.StorageSigningEndpoint || undefined
  })

  const nodeEnv = isProd ? 'production' : 'development'
  const otelEndpoint =
    secrets.OTEL_EXPORTER_OTLP_ENDPOINT ||
    (['dev', 'local'].includes(appStage) ? 'http://localhost:4318' : '')

  return {
    urls: {
      frontend: frontendUrl,
      vps: vpsUrl,
      bucketRouter: bucketRouterUrl
    },
    auth: {
      emailSender,
      accessTokenSecret: 'secret',
      refreshTokenSecret: 'secret',
      betterAuthSecret: secrets.BETTER_AUTH_SECRET,
      betterAuthUrl: secrets.BETTER_AUTH_URL
    },
    encryption: {
      rootKey: secrets.GBFM_ENCRYPTION_ROOT_KEY
    },
    spotify: {
      clientId: secrets.SpotifyClientId,
      clientSecret: secrets.SpotifyClientSecret
    },
    buckets: {
      userContent: userContentBucketName,
      mixes: mixesBucketName
    },
    storage,
    app: {
      stage: appStage,
      nodeEnv,
      dbStage: isProd ? 'prod' : undefined,
      logLevel: undefined
    },
    otel: {
      endpoint: otelEndpoint,
      headers: secrets.OTEL_EXPORTER_OTLP_HEADERS || undefined
    },
    sentry: {
      dsn: secrets.SENTRY_BACKEND_DSN,
      environment: bindings?.SENTRY_ENVIRONMENT ?? (isProd ? 'production' : 'development')
    },
    adminEmail: stringValue(bindings?.ADMIN_EMAIL, 'guidefari@icloud.com'),
    resources: {
      available: bindings !== undefined
    }
  }
}

const makeConfigServiceLayer = (bindings?: WorkerConfigBindings) =>
  Layer.effect(
    ConfigService,
    Schema.decodeUnknownEffect(ConfigSchema)(createConfig(bindings)).pipe(Effect.orDie)
  )

export const ConfigServiceLayer = makeConfigServiceLayer()

export const WorkerConfigServiceLayer = (bindings: WorkerConfigBindings) =>
  makeConfigServiceLayer(bindings)

export const WorkerConfigServiceLayerEffect = <E>(
  bindings: Effect.Effect<WorkerConfigBindings, E>
) =>
  Layer.effect(
    ConfigService,
    bindings.pipe(
      Effect.flatMap((resolved) =>
        Schema.decodeUnknownEffect(ConfigSchema)(createConfig(resolved))
      ),
      Effect.orDie
    )
  )
