import path from "node:path";
import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

const relativePath = path.relative(process.cwd(), __filename);

console.log(`🔒 SSL Configuration Reminder
If you need to connect to the production database from local, 
uncomment the SSL configuration in ${relativePath} .`);

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
		// ssl: {
		// 	rejectUnauthorized: false,
		// },
		// ssl: false,
	},
});
