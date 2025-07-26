import type { insertAuthorSchema } from "./db/author.schema";
import type { createPostSchema } from "./db/post.schema";
import type { createMixSchema } from "./db/mix.schema";
import type { z } from "zod";
import type { selectPublicationSchema } from "./db/publication.schema";

export const mixes: Array<z.infer<typeof createMixSchema>> = [
	{
		title: "Mix 1",
		description: "Description 1",
		thumbnailUrl: "https://example.com/thumbnail1.jpg",
		slug: "mix-1",
		content: "Content 1",
		authorIds: ["1", "2"],
		url: "https://example.com/mix1.mp3",
		draft: false,
		tags: ["dnb", "techno", "house"],
	},
];

export const authors: Array<z.infer<typeof insertAuthorSchema>> = [
	{
		name: "Author 1",
		email: "author1@example.com",
		username: "author1",
	},
	{
		name: "Author 2",
		email: "author2@example.com",
		username: "author2",
	},
];

export const posts: Array<z.infer<typeof createPostSchema>> = [
	{
		title: "Post 1",
		description: "Description 1",
		thumbnailUrl: "https://example.com/thumbnail1.jpg",
		slug: "post-1",
		content: "Content 1",
		authorIds: ["1", "2"],
		draft: false,
		tags: ["dnb", "techno", "house"],
		type: "post",
		publicationId: "1",
	},
	{
		title: "Micro 1",
		description: "Description 1",
		thumbnailUrl: "https://example.com/thumbnail1.jpg",
		slug: "micro-1",
		content: "Content 1",
		authorIds: ["1"],
		draft: false,
		tags: ["dnb", "techno", "house"],
		type: "micro",
		publicationId: "1",
	},
	{
		title: "Label 1",
		description: "Description 1",
		thumbnailUrl: "https://example.com/thumbnail1.jpg",
		slug: "label-1",
		content: "Content 1",
		authorIds: ["1"],
		draft: false,
		tags: ["dnb", "techno", "house"],
		type: "label",
		publicationId: "1",
	},
];

export const publications: Array<z.infer<typeof selectPublicationSchema>> = [
	{
		id: "1",
		name: "Publication 1",
		description: "Description 1",
		slug: "publication-1",
	},
];
