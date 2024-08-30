import { z } from "zod";

export const AuthorSchema = z.object({
	name: z.string(),
	avatar: z.string().optional(),
	title: z.string().optional(),
	email: z.string().optional(),
	website: z.string().optional(),
	draft: z.boolean().optional(),
	slug: z.string().optional(),
});

export const LabelSchema = z.object({
	name: z.string(),
	thumbnailUrl: z.string(),
	website: z.string().optional(),
	discogs: z.string().optional(),
	bandcamp: z.string().optional(),
	genres: z.array(z.string()).optional(),
	slug: z.string().optional(),
});

export const MixSchema = z.object({
	title: z.string(),
	description: z.string().optional(),
	date: z.string(),
	mp3Url: z.string(),
	thumbnailUrl: z.string().optional(),
	youtubeId: z.string().optional(),
	author: z.string().optional(),
	genres: z.array(z.string()).optional(),
	slug: z.string().optional(),
});

export const PostSchema = z.object({
	title: z.string(),
	description: z.string().optional(),
	date: z.string(),
	lastmod: z.string().optional(),
	tags: z.array(z.string()).optional(),
	draft: z.boolean().optional(),
	canonicalUrl: z.string().optional(),
	thumbnailUrl: z.string().optional(),
	authors: z.array(z.string()).optional(),
	slug: z.string().optional(),
});

export const MicroPostSchema = z.object({
	authorName: z.string(),
	handle: z.string().optional(),
	date: z.date(),
	avatarUrl: z.string(),
	slug: z.string().optional(),
});

// Infer types from schemas
export type AuthorFrontmatter = z.infer<typeof AuthorSchema>;
export type LabelFrontmatter = z.infer<typeof LabelSchema>;
export type MixFrontmatter = z.infer<typeof MixSchema>;
export type PostFrontmatter = z.infer<typeof PostSchema>;
export type MicroPostFrontmatter = z.infer<typeof MicroPostSchema>;
