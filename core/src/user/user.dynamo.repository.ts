import type { User } from ".";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	PutCommand,
	GetCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { createID } from "@/util/id";
import { Resource } from "sst/resource";
import { subjects } from "../../../functions/src/subjects";

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export class DynamoUserRepository implements User.IUserRepository {
	async create(email: string) {
		const id = createID("user");
		const write = await dynamoClient.send(
			new PutCommand({
				TableName: Resource.UserTable.name,
				Item: { id, email },
			}),
		);

		return {
			id,
			email,
		};
	}

	async fromID(id: string) {
		// Implement DynamoDB logic to fetch a user by ID
		const user = await dynamoClient.send(
			new GetCommand({
				TableName: Resource.UserTable.name,
				Key: { id },
			}),
		);

		return user.Item;
		// return User.UserSchema.parse(user.Item);
	}

	async fromEmail(email: string) {
		// Implement DynamoDB logic to fetch a user by email
		const user = await dynamoClient.send(
			new QueryCommand({
				TableName: Resource.UserTable.name,
				IndexName: "EmailIndex",
				KeyConditionExpression: "email = :email",
				ExpressionAttributeValues: {
					":email": email,
				},
			}),
		);

		if (user.Items && user.Items.length > 1) {
			console.info("Multiple users found with the same email");
		}

		return user.Items?.[0];
	}

	async update(user: User.PartialUser) {
		const keysToUpdate = Object.keys(user).filter((key) => key !== "id");

		const expressionAttributeValues = keysToUpdate.reduce(
			(acc, key) => {
				acc[`:${key}`] = user[key as keyof User.PartialUser];
				return acc;
			},
			{} as Record<string, unknown>,
		);

		const update = await dynamoClient.send(
			new UpdateCommand({
				TableName: Resource.UserTable.name,
				Key: { id: user.id },
				ExpressionAttributeValues: expressionAttributeValues,
				UpdateExpression: `SET ${keysToUpdate.map((key) => `${key} = :${key}`).join(", ")}`,
				ReturnValues: "ALL_NEW",
			}),
		);

		return update.Attributes;
	}

	async deleteByID(id: string) {
		// Implement DynamoDB logic to delete a user by ID
		return true;
	}

	async fromToken(token: string) {
		return token;
		// const session = await AuthClient_API.verify(subjects, token);

		// if (session.err) {
		// 	console.error({ "session.err": session.err });
		// 	console.error("No session");
		// 	return null;
		// }

		// return session.subject.properties;
	}
}
