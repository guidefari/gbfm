import { migrate as migratePostgres } from "drizzle-orm/aws-data-api/pg/migrator";
import { db } from "./db";

export const migrate = async (path: string) => {
	console.log("Running migrations...");
	await migratePostgres(db, { migrationsFolder: path });
	console.log("Migrations completed.");
};
migrate("./drizzle/");
