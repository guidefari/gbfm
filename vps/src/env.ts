import { z } from 'zod';
import { Resource } from 'sst';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  EMAIL_SENDER: z.string(),
});

function createEnvConfig() {
  let databaseUrl = process.env.DATABASE_URL || '';
  let emailSender = process.env.EMAIL_SENDER || '';
  let isLocal = false;

  isLocal = Object.keys(Resource).length === 0 || Resource.App.stage === "local";

  if (!isLocal) {
    const { username, password, host, port, database } = Resource.gbfm_postgres
    databaseUrl = `postgresql://${username}:${password}@${host}:${port}/${database}`
    emailSender = Resource.Email.sender
  } else {
    databaseUrl = process.env.DATABASE_URL || '';
    emailSender = process.env.EMAIL_SENDER || '';
  }
  
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
