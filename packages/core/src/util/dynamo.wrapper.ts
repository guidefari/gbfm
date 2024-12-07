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
		schema: ZodSchema<T>,
	) => {
		const command = new BatchWriteCommand({
			RequestItems: {
				[tableName]: input.map((item) => ({ PutRequest: { Item: item } })),
			},
		});
		const response = await client.send(command);
		return response.UnprocessedItems;
	};

	export const listAll = async <T extends object>(
		tableName: string,
	): Promise<T[]> => {
		const command = new ScanCommand({
			TableName: tableName,
		});
		const response = await client.send(command);
		return response.Items;
	};
}
