import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  
  DATABASE_URL: z.string().url(),
  RESEND_API_KEY: z.string(),
//   JWT_SECRET: z.string().min(32),
//   JWT_EXPIRES_IN: z.string().default('7d'),
  
//   API_PREFIX: z.string().default('/api'),
//   CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
});

function createEnvConfig() {
  try {
    const config = envSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => err.path.join('.'));
      throw new Error(
        `❌ Invalid environment variables: ${missingVars.join(', ')}\n${error.message}`
      );
    }
    throw error;
  }
}

export const env = createEnvConfig();

export type Env = z.infer<typeof envSchema>;
