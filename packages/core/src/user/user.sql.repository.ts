import { insertUser, userTable } from "../drizzle/schemas/user.sql";
import { and, eq } from "drizzle-orm";
import { db } from "../drizzle";
import { createID } from "@/util/id";
import type { User } from ".";

export class SqlUserRepository implements User.IUserRepository {
	fromToken(token: string): Promise<User.PartialUser | null> {
		throw new Error("Method not implemented.");
	}
	async update(user: User.PartialUser) {
		console.info("Method not implemented.");
		return user;
	}
	async deleteByID(id: string) {
		console.info("Method not implemented.");
		return false;
	}
	async create(email: string) {
		const id = createID("user");
		const user = await insertUser({ id, email });
		return this.serialize(user);
	}

	async fromID(id: string) {
		const rows = await db.select().from(userTable).where(eq(userTable.id, id));

		return rows.map(this.serialize).at(0) || null;
	}

	async fromEmail(email: string) {
		const rows = await db
			.select()
			.from(userTable)
			.where(and(eq(userTable.email, email)));
		return rows.map(this.serialize).at(0) || null;
	}

	private serialize(input: typeof userTable.$inferSelect): User.PartialUser {
		return {
			id: input.id,
			email: input.email,
			...(input.username && { username: input.username }),
			...(input.password && { password: input.password }),
			...(input.firstname && { firstname: input.firstname }),
			...(input.lastname && { lastname: input.lastname }),
			...(input.isDeleted && { isDeleted: input.isDeleted }),
			...(input.isVerified && { isVerified: input.isVerified }),
		};
	}
}
