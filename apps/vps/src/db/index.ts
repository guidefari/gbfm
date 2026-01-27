import { Effect } from "effect";
import { config } from "@/services/config.service";
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// const isProd = config.app.stage === 'prod'

const dbConfig = {
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  ssl: { rejectUnauthorized: false },
  // ssl: isProd ? true : { rejectUnauthorized: false }
};
Effect.logInfo("[DB] Connecting to database", {
  stage: config.app.dbStage || "prod",
  host: dbConfig.host,
  database: dbConfig.database,
}).pipe(Effect.runPromise);

const pool = new Pool(dbConfig);

export const db = drizzle(pool);
