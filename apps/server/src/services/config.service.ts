import { isRecord } from '@gbfm/core/utils'
import { Context, Effect, Layer, Redacted, Schema } from 'effect'

let Resource: { [key: string]: unknown } | null = null
try {
  Resource = require('sst').Resource
} catch {}

const secretNames = [
  'SpotifyClientId',
  'SpotifyClientSecret',
  'DatabaseHost',
  'DatabaseUser',
  'DatabasePassword',
  'DatabasePort',
  'DatabaseName',
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

// The aws provider resolves credentials from the ECS instance role, so these
// are legitimately blank in production.
const optionalSecretNames: readonly SecretName[] = [
  'StorageEndpoint',
  'StorageAccessKeyId',
  'StorageSecretAccessKey',
  'StorageSigningEndpoint'
]

export type WorkerConfigBindings = Readonly<
  Record<SecretName, string | undefined> & {
    APP_STAGE: string
    USER_CONTENT_BUCKET_NAME: string
    MIXES_BUCKET_NAME: string
    SENTRY_ENVIRONMENT?: string
    ADMIN_EMAIL?: string
  }
>

function getResource(name: string): unknown {
  try {
    return Resource?.[name]
  } catch {
    return undefined
  }
}

function stringValue(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number') return String(value)
  return fallback
}

function numberValue(value: unknown, fallback: number, name: string): number {
  const parsedValue =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : fallback

  if (Number.isNaN(parsedValue)) {
    throw new Error(`Invalid number value for ${name}: ${value}`)
  }

  return parsedValue
}

function secretValue(name: SecretName, bindings: WorkerConfigBindings | undefined): unknown {
  if (bindings) return bindings[name]
  const resource = getResource(name)
  return isRecord(resource) && 'value' in resource ? resource.value : resource
}

function secretString(
  name: SecretName,
  fallback: string,
  bindings: WorkerConfigBindings | undefined
): string {
  return stringValue(secretValue(name, bindings), fallback)
}

function secretNumber(
  name: 'DatabasePort',
  fallback: number,
  bindings: WorkerConfigBindings | undefined
): number {
  return numberValue(secretValue(name, bindings), fallback, name)
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

function resourceValue(name: string): unknown {
  const resource = getResource(name)
  return isRecord(resource) && 'value' in resource ? resource.value : resource
}

function resourceString(name: string, property: string, fallback: string): string {
  const resource = getResource(name)
  if (!isRecord(resource) || !(property in resource)) return fallback
  return stringValue(resource[property], fallback)
}

/** Parsed object storage configuration. R2 requires signing credentials and an account ID. */
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
    storage.provider === 'aws' ||
    (storage.accountId !== undefined &&
      storage.accessKeyId !== undefined &&
      storage.secretAccessKey !== undefined)
      ? undefined
      : 'r2 provider requires an account ID and credentials'
  )
)

const ConfigSchema = Schema.Struct({
  database: Schema.Struct({
    host: Schema.String,
    port: Schema.Number,
    user: Schema.String,
    password: Schema.String,
    name: Schema.String
  }),
  urls: Schema.Struct({
    frontend: Schema.String,
    vps: Schema.String,
    bucketRouter: Schema.String
  }),
  auth: Schema.Struct({
    emailSender: Schema.String,
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

  const missing = secretNames.filter(
    (name) =>
      !optionalSecretNames.includes(name) &&
      stringValue(secretValue(name, bindings), '').trim().length === 0
  )
  if (missing.length > 0) {
    throw new Error(`Missing required production secrets: ${missing.join(', ')}`)
  }
}

export function createConfig(bindings?: WorkerConfigBindings): ConfigService {
  const appStage = bindings?.APP_STAGE ?? resourceString('App', 'stage', 'dev')
  const isProd = appStage === 'prod'

  const secrets = {
    SpotifyClientId: secretString('SpotifyClientId', '', bindings),
    SpotifyClientSecret: secretString('SpotifyClientSecret', '', bindings),
    DatabaseHost: secretString('DatabaseHost', 'localhost', bindings),
    DatabaseUser: secretString('DatabaseUser', 'postgres', bindings),
    DatabasePassword: secretString('DatabasePassword', 'postgres', bindings),
    DatabasePort: secretString('DatabasePort', '5432', bindings),
    DatabaseName: secretString('DatabaseName', 'postgres', bindings),
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
    StorageProvider: secretString('StorageProvider', 'aws', bindings),
    StorageEndpoint: secretString('StorageEndpoint', '', bindings),
    StorageRegion: secretString('StorageRegion', 'auto', bindings),
    StorageAccessKeyId: secretString('StorageAccessKeyId', '', bindings),
    StorageSecretAccessKey: secretString('StorageSecretAccessKey', '', bindings),
    StorageSigningEndpoint: secretString('StorageSigningEndpoint', '', bindings)
  }

  requiredInProduction(isProd, bindings)

  const frontendUrl = resourceString('Urls', 'site', 'http://127.0.0.1:5173')
  const vpsUrl = resourceString('Urls', 'vps', 'http://127.0.0.1:3003')
  const bucketRouterUrl = 'https://cdn.goosebumps.fm'
  const emailSender = resourceString('Email', 'sender', '')
  const userContentBucketName =
    bindings?.USER_CONTENT_BUCKET_NAME ?? resourceString('User_Content', 'name', 'user-content-dev')
  const mixesBucketName =
    bindings?.MIXES_BUCKET_NAME ?? resourceString('Mixes', 'name', 'mixes-dev')
  const storage = Schema.decodeUnknownSync(StorageConfigSchema)({
    provider: secrets.StorageProvider,
    accountId: r2AccountId(secrets.StorageEndpoint),
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
    database: {
      host: secrets.DatabaseHost,
      port: secretNumber('DatabasePort', 5432, bindings),
      user: secrets.DatabaseUser,
      password: secrets.DatabasePassword,
      name: secrets.DatabaseName
    },
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
    adminEmail: stringValue(
      bindings?.ADMIN_EMAIL ?? resourceValue('AdminEmail'),
      'guidefari@icloud.com'
    ),
    resources: {
      available: bindings !== undefined || Resource !== null
    }
  }
}

const makeConfigServiceLayer = (bindings?: WorkerConfigBindings) =>
  Layer.effect(
    ConfigService,
    Effect.sync(() => Schema.decodeUnknownSync(ConfigSchema)(createConfig(bindings)))
  )

export const ConfigServiceLayer = makeConfigServiceLayer()

export const WorkerConfigServiceLayer = (bindings: WorkerConfigBindings) =>
  makeConfigServiceLayer(bindings)
