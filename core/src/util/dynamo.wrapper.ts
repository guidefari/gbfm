import { compileMdx } from "@/mdx";
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
		const items = response.Items ?? [];

		if (items.length > 0 && "content" in items[0]) {
			return Promise.all(
				items.map(async (item) => ({
					...item,
					content: await compileMdx(item.content),
				})),
			);
		}

		return items;
	};

	export const getContentListByPrefix = async () => {};

	export const readById = async <T extends object>(
		tableName: string,
		contentId: string,
	): Promise<T | null> => {
		const command = new ScanCommand({
			TableName: tableName,
			FilterExpression: "contentId = :contentId",
        ExpressionAttributeValues: {
            ":contentId": contentId,
        },
		});

		const response = await client.send(command);
		const item = response.Items?.[0];

		if (!item) return null;

		// If the item has content field, compile MDX
		if ("content" in item) {
			return {
				...item,
				content: await compileMdx(item.content),
			} as T;
		}

		return item as T;
	};
}
