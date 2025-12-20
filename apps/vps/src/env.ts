import { Resource } from 'sst'
import { z } from 'zod'

const envSchema = z.object({
  // DATABASE_URL: z.url(),
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .optional(),
  EMAIL_SENDER: z.string(),
  ACCESS_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  SPOTIFY_CLIENT_ID: z.string(),
  SPOTIFY_CLIENT_SECRET: z.string(),
  DB_STAGE: z.string().optional()
})

const isProd = Resource.App.stage === 'prod'

function createEnvConfig() {
  const emailSender = isProd
    ? Resource.Email.sender
    : process.env.EMAIL_SENDER || ''
  const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || 'secret'
  const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'secret'
  const betterAuthSecret = process.env.BETTER_AUTH_SECRET || Resource.BETTER_AUTH_SECRET.value
  const betterAuthUrl = process.env.BETTER_AUTH_URL || Resource.BETTER_AUTH_URL.value
  const frontendUrl = isProd
    ? Resource.Urls.site
    : process.env.FRONTEND_URL || 'http://localhost:5173'
  const spotifyClientId =
    Resource.SpotifyClientId.value || process.env.SPOTIFY_CLIENT_ID || ''
  const spotifyClientSecret =
    Resource.SpotifyClientSecret.value ||
    process.env.SPOTIFY_CLIENT_SECRET ||
    ''

  try {
    const config = envSchema.parse({
      ...process.env,
      // DATABASE_URL: databaseUrl,
      EMAIL_SENDER: emailSender,
      ACCESS_TOKEN_SECRET: accessTokenSecret,
      REFRESH_TOKEN_SECRET: refreshTokenSecret,
      BETTER_AUTH_SECRET: betterAuthSecret,
      BETTER_AUTH_URL: betterAuthUrl,
      FRONTEND_URL: frontendUrl,
      SPOTIFY_CLIENT_ID: spotifyClientId,
      SPOTIFY_CLIENT_SECRET: spotifyClientSecret,
      DB_STAGE: process.env.DB_STAGE
    })

    return config
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid env:')
      console.error(JSON.stringify(error.flatten().fieldErrors, null, 2))
    }
    throw new Error('Failed to load environment configuration')
  }
}

// biome-ignore lint/style/noNonNullAssertion: 👀
export const env = createEnvConfig()!

export type Env = z.infer<typeof envSchema>
