import { z } from 'zod';
import { Resource } from 'sst';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  EMAIL_SENDER: z.string(),
  ACCESS_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
  FRONTEND_URL: z.string().url(),
});

function createEnvConfig() {
  let databaseUrl = process.env.DATABASE_URL || '';
  let emailSender = process.env.EMAIL_SENDER || '';
  let accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || 'secret';
  let refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || 'secret';
  let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  const isLocal = Object.keys(Resource).length === 0 || ["local", "dev"].includes(Resource.App.stage);

  if (!isLocal) {
    const { username, password, host, port, database } = Resource.gbfm_postgres
    databaseUrl = `postgresql://${username}:${password}@${host}:${port}/${database}`
    emailSender = Resource.Email.sender
    accessTokenSecret = Resource.ACCESS_TOKEN_SECRET.value
    refreshTokenSecret = Resource.REFRESH_TOKEN_SECRET.value
    frontendUrl = Resource['gbfm-www'].url
  }
  
  try {
    const config = envSchema.parse({
      ...process.env,
      DATABASE_URL: databaseUrl,
      EMAIL_SENDER: emailSender,
      ACCESS_TOKEN_SECRET: accessTokenSecret,
      REFRESH_TOKEN_SECRET: refreshTokenSecret,
      FRONTEND_URL: frontendUrl,
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
