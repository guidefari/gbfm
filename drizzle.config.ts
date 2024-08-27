import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "src/db/models/**/**schema.ts",
	dialect: "postgresql",
	out: "src/db/migrations",
	dbCredentials: {
		url: process.env.DATABASE_URL as string,
	},
	verbose: true,
	strict: true,
});
