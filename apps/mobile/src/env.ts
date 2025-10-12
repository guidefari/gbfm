import { z } from 'zod'

const envSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url(),
  isDev: z.boolean()
})

function createEnvConfig() {
  try {
    const config = envSchema.parse({
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      isDev: process.env.NODE_ENV === 'development' || __DEV__
    })
    return config
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid env:')
      console.error(JSON.stringify(z.treeifyError(error), null, 2))
    }
    throw new Error('Failed to load environment configuration')
  }
}

export const env = createEnvConfig()

export type Env = z.infer<typeof envSchema>
