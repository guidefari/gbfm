import { defineConfig } from "drizzle-kit";
import { env } from "./src/env";
import { Resource } from "sst";

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

const dbStage = env.DB_STAGE || "dev";

console.log('connecting to db stage', dbStage)

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/*.schema.ts",
	dialect: "postgresql",
	dbCredentials: env.DB_STAGE === "dev" ? localPgConfig : prodPgConfig,
	// dbCredentials: localPgConfig,
})