import { z } from 'zod'

const envSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url(),
  EXPO_PUBLIC_SPOTIFY_CLIENT_ID: z.string().optional(),
  isDev: z.boolean()
})

function createEnvConfig() {
  try {
    const config = envSchema.parse({
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_SPOTIFY_CLIENT_ID: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
      isDev: process.env.NODE_ENV === 'development' || __DEV__
    })
    return config
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid env:')
      console.error(JSON.stringify(z.treeifyError(error), null, 2))
    }
    throw new Error('Failed to load environment configuration', { cause: error })
  }
}

export const env = createEnvConfig()

export type Env = z.infer<typeof envSchema>
