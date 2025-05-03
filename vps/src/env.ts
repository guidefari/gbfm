import { z } from 'zod';
import { Resource } from 'sst/resource';

const envSchema = z.object({
  // NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // PORT: z.coerce.number().default(3000),
  
  DATABASE_URL: z.string().url(),
  EMAIL_SENDER: z.string(),
  // RESEND_API_KEY: z.string(),
//   JWT_SECRET: z.string().min(32),
//   JWT_EXPIRES_IN: z.string().default('7d'),
  
//   API_PREFIX: z.string().default('/api'),
//   CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
});

function createEnvConfig() {

  const { username, password, host, port, database } = Resource.gbfm_postgres
  const databaseUrl = `postgresql://${username}:${password}@${host}:${port}/${database}`
  const emailSender = Resource.Email.sender
  
  try {
    const config = envSchema.parse({
      ...process.env,
      DATABASE_URL: databaseUrl,
      EMAIL_SENDER: emailSender,
    });
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
