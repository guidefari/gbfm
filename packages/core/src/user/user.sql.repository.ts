// core/src/user/user.sql.repository.ts
import type { UserRepository } from "./user.repository";
import { fn } from "@/util/fn";
import type { z } from "zod";
import { insertUser, userTable } from "./user.sql";
import { and, eq } from "drizzle-orm";
import { db } from "../drizzle";
import { createID } from "@/util/id";
import type { User } from ".";

export class SqlUserRepository implements UserRepository {
	async create(email: string): Promise<z.infer<typeof User.UserSchema>> {
		const id = createID("user");
		const user = await insertUser({ id, email });
		return this.serialize(user);
	}

	async fromID(id: string): Promise<z.infer<typeof User.UserSchema> | null> {
		const rows = await db.select().from(userTable).where(eq(userTable.id, id));
		return rows.map(this.serialize).at(0) || null;
	}

	async fromEmail(
		email: string,
	): Promise<z.infer<typeof User.UserSchema> | null> {
		const rows = await db
			.select()
			.from(userTable)
			.where(and(eq(userTable.email, email)));
		return rows.map(this.serialize).at(0) || null;
	}

	private serialize(
		input: typeof userTable.$inferSelect,
	): z.infer<typeof User.UserSchema> {
		return {
			id: input.id,
			email: input.email,
		};
	}
}
