// core/src/user/user.dynamo.repository.ts
import type { User } from ".";
import type { UserRepository } from "./user.repository";
import type { z } from "zod";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { createID } from "@/util/id";
import { Resource } from "sst/resource";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export class DynamoUserRepository implements UserRepository {
	async create(email: string): Promise<z.infer<typeof User.UserSchema>> {
		// Implement DynamoDB logic to create a user
		console.log("implement me!");
		const write = await client.send(
			new PutCommand({
				TableName: Resource.UserTable.name,
				Item: { id: createID("user"), email },
			}),
		);
		console.log("write:", write);

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
