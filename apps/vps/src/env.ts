import { Resource } from "sst";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.string().default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  EMAIL_SENDER: z.string(),
  ACCESS_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
  FRONTEND_URL: z.string().url(),
});

const isProd = Resource.App.stage === "prod";

function createEnvConfig() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    `postgresql://${Resource.gbfm_postgres.username}:${Resource.gbfm_postgres.password}@${Resource.gbfm_postgres.host}:${Resource.gbfm_postgres.port}/${Resource.gbfm_postgres.database}`;
  const emailSender = isProd
    ? Resource.Email.sender
    : process.env.EMAIL_SENDER || "";
  const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || "secret";
  const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || "secret";
  const frontendUrl = isProd
    ? Resource.Urls.site
    : process.env.FRONTEND_URL || "http://localhost:5173";

  try {
console.log(databaseUrl)
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
      console.error("❌ Invalid env:");
      console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
    }
  }
}

export const env = createEnvConfig()!;

export type Env = z.infer<typeof envSchema>;
