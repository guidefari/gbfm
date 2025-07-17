import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

console.log(Resource);

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/*.schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		host: Resource.gbfm_postgres.host,
		port: Resource.gbfm_postgres.port,
		user: Resource.gbfm_postgres.username,
		password: Resource.gbfm_postgres.password,
		database: Resource.gbfm_postgres.database,
	},
});
