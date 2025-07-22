import { relations } from "drizzle-orm/relations";
import { publications, posts, publicationAuthors, authors, publicationPosts, mixes, mixesToAuthors, postsToAuthors } from "./schema";

export const postsRelations = relations(posts, ({one, many}) => ({
	publication: one(publications, {
		fields: [posts.publicationId],
		references: [publications.id]
	}),
	publicationPosts: many(publicationPosts),
	postsToAuthors: many(postsToAuthors),
}));

export const publicationsRelations = relations(publications, ({many}) => ({
	posts: many(posts),
	publicationAuthors: many(publicationAuthors),
	publicationPosts: many(publicationPosts),
}));

export const publicationAuthorsRelations = relations(publicationAuthors, ({one}) => ({
	publication: one(publications, {
		fields: [publicationAuthors.publicationId],
		references: [publications.id]
	}),
	author: one(authors, {
		fields: [publicationAuthors.authorId],
		references: [authors.id]
	}),
}));

export const authorsRelations = relations(authors, ({many}) => ({
	publicationAuthors: many(publicationAuthors),
	mixesToAuthors: many(mixesToAuthors),
	postsToAuthors: many(postsToAuthors),
}));

export const publicationPostsRelations = relations(publicationPosts, ({one}) => ({
	publication: one(publications, {
		fields: [publicationPosts.publicationId],
		references: [publications.id]
	}),
	post: one(posts, {
		fields: [publicationPosts.postId],
		references: [posts.id]
	}),
}));

export const mixesToAuthorsRelations = relations(mixesToAuthors, ({one}) => ({
	mix: one(mixes, {
		fields: [mixesToAuthors.mixId],
		references: [mixes.id]
	}),
	author: one(authors, {
		fields: [mixesToAuthors.authorId],
		references: [authors.id]
	}),
}));

export const mixesRelations = relations(mixes, ({many}) => ({
	mixesToAuthors: many(mixesToAuthors),
}));

export const postsToAuthorsRelations = relations(postsToAuthors, ({one}) => ({
	post: one(posts, {
		fields: [postsToAuthors.postId],
		references: [posts.id]
	}),
	author: one(authors, {
		fields: [postsToAuthors.authorId],
		references: [authors.id]
	}),
}));