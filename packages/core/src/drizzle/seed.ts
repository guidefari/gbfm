import { getTableName, type Table, sql } from "drizzle-orm";
import { db } from "./index";
// import { accountTable } from "../account/account.sql";
// import { userTable } from "../user/user.sql";
import { microPostsTable } from "../microPost/microPost.sql";
import { postsTable } from "../post/post.sql";
import { mixesTable } from "../mix/mix.sql";
import { moodTable } from "../mood/mood.sql";
// import { recordLabelTable } from "../record_label/record_label.sql";

async function resetTable(db: db, table: Table) {
	return db.execute(
		sql.raw(`TRUNCATE TABLE ${getTableName(table)} RESTART IDENTITY CASCADE`),
	);
}

for (const table of [
	// accountTable,
	// userTable,
	microPostsTable,
	postsTable,
	mixesTable,
	moodTable,
]) {
	await resetTable(db, table);
}
