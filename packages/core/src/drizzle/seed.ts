import { getTableName, type Table, sql } from "drizzle-orm";
import { db } from "./index";
// import { accountTable } from "../account/account.sql";
// import { userTable } from "../user/user.sql";
import { microPostsTable } from "../microPost/microPost.sql";
import { postsTable } from "../post/post.sql";
import { mixesTable } from "../mix/mix.sql";
import { moodTable } from "../mood/mood.sql";
import { recordLabelTable } from "@/record_label/record_label.sql";
// import { recordLabelTable } from "../record_label/record_label.sql";

async function resetTable(db: db, table: Table) {
	console.log(`Resetting table ${getTableName(table)}`);

	return db.execute(
		sql.raw(`TRUNCATE TABLE ${getTableName(table)} RESTART IDENTITY CASCADE`),
	);
}

async function deleteTable(db: db, table: Table) {
	console.log(`Deleting table ${getTableName(table)}`);

	return db.execute(sql.raw(`DROP TABLE IF EXISTS ${getTableName(table)}`));
}

for (const table of [
	// accountTable,
	// userTable,
	microPostsTable,
	postsTable,
	mixesTable,
	moodTable,
	recordLabelTable,
]) {
	await resetTable(db, table);
	// await deleteTable(db, table);
}

await db.$client.end();
