import { drizzle } from "drizzle-orm/node-postgres";
import { Resource } from "sst";
import { z } from "zod";
import { Pool } from "pg";

const connectionStringSchema = z
	.string()
	.url()
	.refine((url) => url.startsWith("postgres://"), {
		message: "URL must start with postgres://",
	});

const connectionString = Resource.SquealDBUrl.value;

if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is not set");
}

try {
	connectionStringSchema.parse(connectionString);
} catch (error) {
	if (error instanceof z.ZodError) {
		console.error("Invalid DATABASE_URL:", error.errors);
	}
	throw new Error("Invalid DATABASE_URL format");
}

const pool = new Pool({
	connectionString,
	max: process.env.DB_MIGRATING || process.env.DB_SEEDING ? 1 : undefined,
});

export const db = drizzle({
	client: pool,
	logger: true,
});
export type db = typeof db;

export default db;
