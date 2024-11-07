import type { z } from "zod";
import { insertUser, userTable } from "../drizzle/schemas/user.sql";
import { and, eq } from "drizzle-orm";
import { db } from "../drizzle";
import { createID } from "@/util/id";
import type { User } from ".";

export class SqlUserRepository implements User.IUserRepository {
	update(user: User.PartialUser): Promise<User.PartialUser> {
		throw new Error("Method not implemented.");
	}
	deleteByID(id: string): Promise<boolean> {
		throw new Error("Method not implemented.");
	}
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
