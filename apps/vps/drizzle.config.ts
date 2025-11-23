import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";
import { env } from "./src/env";

const localPgConfig = {
	host: "localhost",
	port: 5432,
	user: "postgres",
	password: "postgres",
	database: "postgres",
	ssl: false,
};

const prodPgConfig = {
	host: Resource.DatabaseHost.value,
	port: Number(Resource.DatabasePort.value),
	user: Resource.DatabaseUser.value,
	password: Resource.DatabasePassword.value,
	database: Resource.DatabaseName.value,
	ssl: false,
};

console.log('connecting to db stage', env.DB_STAGE || 'prod')

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/*.schema.ts",
	dialect: "postgresql",
	dbCredentials: env.DB_STAGE === "dev" ? localPgConfig : prodPgConfig,
});
