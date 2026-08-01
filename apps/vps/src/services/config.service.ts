import { isRecord } from '@gbfm/core/utils'
import { Context, Effect, Layer, Schema } from 'effect'

let Resource: { [key: string]: unknown } | null = null
try {
  Resource = require('sst').Resource
} catch {}

function getResource(name: string): unknown {
  try {
    return Resource?.[name]
  } catch {
    return undefined
  }
}

function stringValue(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value
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

function secretString(name: string, fallback: string): string {
  const resource = getResource(name)
  const value = isRecord(resource) && 'value' in resource ? resource.value : resource
  return stringValue(value, fallback)
}

function secretNumber(name: string, fallback: number): number {
  const resource = getResource(name)
  const value = isRecord(resource) && 'value' in resource ? resource.value : resource
  return numberValue(value, fallback, name)
}

function resourceString(name: string, property: string, fallback: string): string {
  const resource = getResource(name)
  if (!isRecord(resource) || !(property in resource)) return fallback
  return stringValue(resource[property], fallback)
}

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
    databaseBackups: Schema.String,
    mixes: Schema.String
  }),
  tasks: Schema.Struct({
    databaseBackup: Schema.optional(Schema.String)
  }),
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

export function createConfig(): ConfigService {
  const appStage = resourceString('App', 'stage', 'dev')
  const isProd = appStage === 'prod'

  const databaseHost = secretString('DatabaseHost', 'localhost')
  const databasePort = secretNumber('DatabasePort', 5432)
  const databaseUser = secretString('DatabaseUser', 'postgres')
  const databasePassword = secretString('DatabasePassword', 'postgres')
  const databaseName = secretString('DatabaseName', 'postgres')

  const frontendUrl = resourceString('Urls', 'site', 'http://127.0.0.1:5173')
  const vpsUrl = resourceString('Urls', 'vps', 'http://127.0.0.1:3003')
  const bucketRouterUrl = 'https://cdn.goosebumps.fm'

  const emailSender = resourceString('Email', 'sender', '')
  const accessTokenSecret = 'secret'
  const refreshTokenSecret = 'secret'
  const betterAuthSecret = secretString('BETTER_AUTH_SECRET', '')
  const betterAuthUrl = secretString('BETTER_AUTH_URL', '')
  const encryptionRootKey = secretString(
    'GBFM_ENCRYPTION_ROOT_KEY',
    'local-development-encryption-key'
  )

  const spotifyClientId = secretString('SpotifyClientId', '')
  const spotifyClientSecret = secretString('SpotifyClientSecret', '')

  const userContentBucketName = resourceString('User_Content', 'name', 'user-content-dev')
  const databaseBackupsBucketName = resourceString(
    'DatabaseBackups',
    'name',
    'database-backups-dev'
  )
  const mixesBucketName = resourceString('Mixes', 'name', 'mixes-dev')

  const databaseBackupTask = resourceString('DatabaseBackupTask', 'taskDefinition', '') || undefined

  const nodeEnv = isProd ? 'production' : 'development'
  const dbStage = isProd ? 'prod' : undefined
  const logLevel = undefined

  const otelEndpoint =
    secretString('OTEL_EXPORTER_OTLP_ENDPOINT', '') ||
    (['dev', 'local'].includes(appStage) ? 'http://localhost:4318' : '')
  const otelHeaders = secretString('OTEL_EXPORTER_OTLP_HEADERS', '')

  const adminEmail = secretString('AdminEmail', 'guidefari@icloud.com')

  const sentryDsn = secretString('SENTRY_BACKEND_DSN', '')
  const sentryEnvironment = isProd ? 'production' : 'development'

  return {
    database: {
      host: databaseHost,
      port: databasePort,
      user: databaseUser,
      password: databasePassword,
      name: databaseName
    },
    urls: {
      frontend: frontendUrl,
      vps: vpsUrl,
      bucketRouter: bucketRouterUrl
    },
    auth: {
      emailSender,
      accessTokenSecret,
      refreshTokenSecret,
      betterAuthSecret,
      betterAuthUrl
    },
    encryption: {
      rootKey: encryptionRootKey
    },
    spotify: {
      clientId: spotifyClientId,
      clientSecret: spotifyClientSecret
    },
    buckets: {
      userContent: userContentBucketName,
      databaseBackups: databaseBackupsBucketName,
      mixes: mixesBucketName
    },
    tasks: {
      databaseBackup: databaseBackupTask
    },
    app: {
      stage: appStage,
      nodeEnv,
      dbStage,
      logLevel
    },
    otel: {
      endpoint: otelEndpoint,
      headers: otelHeaders
    },
    sentry: {
      dsn: sentryDsn,
      environment: sentryEnvironment
    },
    adminEmail,
    resources: {
      available: Resource !== null
    }
  }
}

// Create a singleton config instance for synchronous access
export const config = createConfig()

export const ConfigServiceLayer = Layer.effect(
  ConfigService,
  Effect.sync(() => Schema.decodeUnknownSync(ConfigSchema)(config))
)
