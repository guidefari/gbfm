import { Resource } from "sst";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/**/*.sql.ts",
	dialect: "postgresql",
	out: "./migrations",
	dbCredentials: {
		url: Resource.SquealDBUrl.value,
	},
	verbose: true,
	strict: true,
});
