import { createID } from "@/util/id";
import type { PaginationInput } from "../util/pagination.types";
import { z } from "zod";
import { fn } from "@/util/fn";
import { DynamoWrapper } from "@/util/dynamo.wrapper";
import { Resource } from "sst";

export namespace MicroPost {
	export const MicroPostSchema = z.object({
		contentId: z.string(),
		content: z.string(),
		createdAt: z.number(),
		updatedAt: z.number(),
		authorId: z.string(),
	});

	export type MicroPost = z.infer<typeof MicroPostSchema>;

	export const create = async (content: string, authorId: string) => {
		const microPost: MicroPost = {
			contentId: createID("microPost"),
			content,
			createdAt: Math.floor(new Date().getTime() / 1000),
			updatedAt: Math.floor(new Date().getTime() / 1000),
			authorId,
		};

		return DynamoWrapper.create(
			Resource.ContentTable.name,
			microPost,
			MicroPostSchema,
		);
	};

	export const listAll = async () => {
		return DynamoWrapper.listAll<MicroPost>(Resource.ContentTable.name);
	};

	export const seed = async (input: MicroPost[]) => {
		return DynamoWrapper.seed(
			Resource.ContentTable.name,
			input,
			MicroPostSchema,
		);
	};
}
