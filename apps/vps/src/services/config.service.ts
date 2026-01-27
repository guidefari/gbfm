import { Context, Layer, Schema } from 'effect'

// Conditionally import Resource to avoid failures when running outside SST
let Resource: { [key: string]: unknown } | null = null
try {
  Resource = require('sst').Resource
} catch {
  // Resource not available when running outside SST
}

// Generic helper to get Resource value with strict type safety
function getResourceValue<T extends string | number>(
  resourcePath: string,
  fallback: T
): T {
  if (!Resource) return fallback

  try {
    const keys = resourcePath.split('.')
    let value: unknown = Resource

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key]
      } else {
        return fallback
      }
    }

    // Handle SST resource format with .value property
    const resourceValue =
      value && typeof value === 'object' && 'value' in value
        ? (value as { value: unknown }).value
        : value

    // Type validation and conversion
    if (typeof fallback === 'number') {
      const numValue =
        typeof resourceValue === 'number'
          ? resourceValue
          : typeof resourceValue === 'string'
            ? Number(resourceValue)
            : fallback

      if (Number.isNaN(numValue)) {
        throw new Error(
          `Invalid number value for ${resourcePath}: ${resourceValue}`
        )
      }

      return numValue as T
    }

    if (typeof fallback === 'string') {
      const strValue =
        typeof resourceValue === 'string'
          ? resourceValue
          : typeof resourceValue === 'number'
            ? String(resourceValue)
            : fallback

      return strValue as T
    }

    return fallback
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Invalid number value')
    ) {
      throw error
    }
    // Resource not available when running outside SST
    return fallback
  }
}

// Config schema using Effect Schema
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
    router: Schema.String,
    bucketRouter: Schema.String
  }),
  auth: Schema.Struct({
    emailSender: Schema.String,
    accessTokenSecret: Schema.String,
    refreshTokenSecret: Schema.String,
    betterAuthSecret: Schema.String,
    betterAuthUrl: Schema.String
  }),
  spotify: Schema.Struct({
    clientId: Schema.String,
    clientSecret: Schema.String
  }),
  buckets: Schema.Struct({
    userContent: Schema.String,
    databaseBackups: Schema.String
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
  })
})

export interface ConfigService
  extends Schema.Schema.Type<typeof ConfigSchema> {}

export const ConfigService = Context.GenericTag<ConfigService>('ConfigService')

export function createConfig(): ConfigService {
  const appStage = getResourceValue(
    'App.stage',
    process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
  )
  const isProd = appStage === 'prod' || process.env.NODE_ENV === 'production'

  // Database configuration
  const databaseHost =
    process.env.DB_HOST || getResourceValue('DatabaseHost', 'localhost')
  const databasePort =
    Number(process.env.DB_PORT) ||
    Number(getResourceValue('DatabasePort', 5432))
  const databaseUser =
    process.env.DB_USER || getResourceValue('DatabaseUser', 'postgres')
  const databasePassword =
    process.env.DB_PASSWORD || getResourceValue('DatabasePassword', 'postgres')
  const databaseName =
    process.env.DB_NAME || getResourceValue('DatabaseName', 'postgres')

  // URLs
  const frontendUrl = isProd
    ? getResourceValue('Urls.site', 'http://localhost:5173')
    : process.env.FRONTEND_URL || 'http://localhost:5173'
  const routerUrl =
    process.env.ROUTER_URL ||
    getResourceValue('Router.url', 'http://localhost:3000')
  const bucketRouterUrl =
    process.env.BUCKET_ROUTER_URL ||
    getResourceValue('BucketRouter.url', 'http://localhost:3000')

  // Auth
  const emailSender = isProd
    ? getResourceValue('Email.sender', '')
    : process.env.EMAIL_SENDER || ''
  const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || 'secret'
  const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'secret'
  const betterAuthSecret =
    process.env.BETTER_AUTH_SECRET || getResourceValue('BETTER_AUTH_SECRET', '')
  const betterAuthUrl =
    process.env.BETTER_AUTH_URL || getResourceValue('BETTER_AUTH_URL', '')

  // Spotify
  const spotifyClientId =
    getResourceValue('SpotifyClientId', '') ||
    process.env.SPOTIFY_CLIENT_ID ||
    ''
  const spotifyClientSecret =
    getResourceValue('SpotifyClientSecret', '') ||
    process.env.SPOTIFY_CLIENT_SECRET ||
    ''

  // Buckets
  const userContentBucketName =
    process.env.USER_CONTENT_BUCKET_NAME ||
    getResourceValue('User_Content.name', 'user-content-dev')
  const databaseBackupsBucketName =
    process.env.DATABASE_BACKUPS_BUCKET_NAME ||
    getResourceValue('DatabaseBackups.name', 'database-backups-dev')

  // Tasks
  const databaseBackupTask =
    process.env.DATABASE_BACKUP_TASK ||
    (process.env.DATABASE_BACKUP_TASK ? undefined : undefined)

  // App
  const nodeEnv = process.env.NODE_ENV || 'development'
  const dbStage = process.env.DB_STAGE
  const logLevel = process.env.LOG_LEVEL

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
      router: routerUrl,
      bucketRouter: bucketRouterUrl
    },
    auth: {
      emailSender,
      accessTokenSecret,
      refreshTokenSecret,
      betterAuthSecret,
      betterAuthUrl
    },
    spotify: {
      clientId: spotifyClientId,
      clientSecret: spotifyClientSecret
    },
    buckets: {
      userContent: userContentBucketName,
      databaseBackups: databaseBackupsBucketName
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
    resources: {
      available: Resource !== null
    }
  }
}

// Create a singleton config instance for synchronous access
export const config = createConfig()

export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Schema.decodeUnknown(ConfigSchema)(config)
)
