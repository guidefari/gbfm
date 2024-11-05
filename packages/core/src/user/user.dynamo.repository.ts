// core/src/user/user.dynamo.repository.ts
import type { User } from ".";
import type { UserRepository } from "./user.repository";
import type { z } from "zod";

export class DynamoUserRepository implements UserRepository {
	async create(email: string): Promise<z.infer<typeof User.UserSchema>> {
		// Implement DynamoDB logic to create a user
		console.log("implement me!");

		return {
			id: "1",
			email,
		};
	}

	async fromID(id: string): Promise<z.infer<typeof User.UserSchema>> {
		// Implement DynamoDB logic to fetch a user by ID
		console.log("implement me!");
		return {
			id,
			email: "test@test.com",
		};
	}

	async fromEmail(email: string): Promise<z.infer<typeof User.UserSchema>> {
		// Implement DynamoDB logic to fetch a user by email
		console.log("implement me!");
		return {
			id: "1",
			email,
		};
	}
}
