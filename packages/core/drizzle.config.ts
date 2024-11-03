import { Resource } from "sst";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/**/*.sql.ts",
	dialect: "postgresql",
	out: "./migrations",
	casing: "snake_case",
	dbCredentials: {
		url: Resource.SquealDBUrl.value,
	},
	verbose: true,
	strict: true,
});
