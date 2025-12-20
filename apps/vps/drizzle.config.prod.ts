import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

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
		ssl: false,
	},
})
