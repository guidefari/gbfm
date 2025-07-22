import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Resource } from "sst";

const pool = new Pool({
	host: Resource.gbfm_postgres.host,
	port: Resource.gbfm_postgres.port,
	user: Resource.gbfm_postgres.username,
	password: Resource.gbfm_postgres.password,
	database: Resource.gbfm_postgres.database,
});

export const db = drizzle(pool);
