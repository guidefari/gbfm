import { Result, Schema } from 'effect'

const UrlString = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => {
      try {
        new URL(value)
        return undefined
      } catch {
        return 'must be a valid URL'
      }
    })
  )
)

const envSchema = Schema.Struct({
  EXPO_PUBLIC_API_URL: UrlString,
  EXPO_PUBLIC_SPOTIFY_CLIENT_ID: Schema.optional(Schema.String),
  isDev: Schema.Boolean
})

function createEnvConfig() {
  const config = Schema.decodeUnknownResult(envSchema)({
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_SPOTIFY_CLIENT_ID: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
    isDev: process.env.NODE_ENV === 'development' || __DEV__
  })

  if (Result.isFailure(config)) {
    console.error('❌ Invalid env:')
    console.error(config.failure.message)
    throw new Error('Failed to load environment configuration', { cause: config.failure })
  }

  return config.success
}

export const env = createEnvConfig()

export type Env = typeof envSchema.Type
