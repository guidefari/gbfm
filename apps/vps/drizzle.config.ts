import path from "node:path";
import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

const relativePath = path.relative(process.cwd(), __filename);

console.log(`🔒 SSL Configuration Reminder
If you need to connect to the production database from local, 
uncomment the SSL configuration in ${relativePath} .`);

console.log(JSON.stringify(Resource.FullDatabaseUrl.value))

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/*.schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		host: Resource.DatabaseHost.value,
		port: Number(Resource.DatabasePort.value),
		user: Resource.DatabaseUser.value,
		password: Resource.DatabasePassword.value,
		database: Resource.DatabaseName.value,
		// ssl: {
		// 	rejectUnauthorized: false,
		// },
		ssl: false,
	},
});
