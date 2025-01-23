import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	PutCommand,
	GetCommand,
	QueryCommand,
	UpdateCommand,
	ScanCommand,
	BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { z, type ZodSchema } from "zod";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// export namespace that implements DynamoWrapper
export namespace DynamoWrapper {
	export const create = async <T extends object>(
		tableName: string,
		input: T,
		schema: ZodSchema<T>,
	): Promise<T> => {
		schema.parse(input);

		const command = new PutCommand({
			TableName: tableName,

			Item: { ...input },
		});
		await client.send(command);
		return input;
	};

	export const seed = async <T extends object>(
		tableName: string,
		input: T[],
	) => {
		const batchSize = 25;
		for (let i = 0; i < input.length; i += batchSize) {
			const batch = input.slice(i, i + batchSize);
			const command = new BatchWriteCommand({
				RequestItems: {
					[tableName]: batch.map((item) => ({
						PutRequest: { Item: item },
					})),
				},
			});
			await client.send(command);
		}

		return true;
	};

	export const listAll = async <T extends object>(tableName: string) => {
		const command = new ScanCommand({
			TableName: tableName,
			Limit: 100,
		});
		const response = await client.send(command);
		return response.Items ?? [];
	};

	// TODO: pagination
	export const listByPrefix = async <T extends object>(
		tableName: string,
		prefix: string,
	) => {
		const command = new ScanCommand({
			TableName: tableName,
			FilterExpression: "contains(contentId, :prefix)",
			ExpressionAttributeValues: {
				":prefix": prefix,
			},
		});
		const response = await client.send(command);
		return response.Items ?? [];
	}
}