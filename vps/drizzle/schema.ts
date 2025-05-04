import { pgTable, unique, uuid, text, index, varchar, timestamp, boolean, foreignKey, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const postType = pgEnum("post_type", ['post', 'micro', 'label'])


export const publications = pgTable("publications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	slug: text().notNull(),
}, (table) => [
	unique("publications_slug_unique").on(table.slug),
]);

export const mixes = pgTable("mixes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	thumbnailUrl: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	draft: boolean().default(false).notNull(),
	tags: varchar({ length: 255 }).array(),
	content: text().notNull(),
	url: varchar({ length: 255 }).notNull(),
}, (table) => [
	index("mixes_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
]);

export const posts = pgTable("posts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	thumbnailUrl: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	draft: boolean().default(false).notNull(),
	tags: varchar({ length: 255 }).array(),
	content: text().notNull(),
	type: postType(),
	publicationId: uuid(),
}, (table) => [
	index("posts_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.publicationId],
			foreignColumns: [publications.id],
			name: "posts_publicationId_publications_id_fk"
		}).onDelete("set null"),
]);

export const authors = pgTable("authors", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	username: varchar({ length: 255 }),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }),
	verified: boolean().default(false).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("authors_username_unique").on(table.username),
	unique("authors_email_unique").on(table.email),
]);

export const publicationAuthors = pgTable("publication_authors", {
	publicationId: uuid().notNull(),
	authorId: uuid().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.publicationId],
			foreignColumns: [publications.id],
			name: "publication_authors_publicationId_publications_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [authors.id],
			name: "publication_authors_authorId_authors_id_fk"
		}).onDelete("cascade"),
]);

export const publicationPosts = pgTable("publication_posts", {
	publicationId: uuid().notNull(),
	postId: uuid().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.publicationId],
			foreignColumns: [publications.id],
			name: "publication_posts_publicationId_publications_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "publication_posts_postId_posts_id_fk"
		}).onDelete("cascade"),
]);

export const mixesToAuthors = pgTable("mixes_to_authors", {
	mixId: uuid().notNull(),
	authorId: uuid().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.mixId],
			foreignColumns: [mixes.id],
			name: "mixes_to_authors_mixId_mixes_id_fk"
		}),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [authors.id],
			name: "mixes_to_authors_authorId_authors_id_fk"
		}),
	primaryKey({ columns: [table.mixId, table.authorId], name: "mixes_to_authors_mixId_authorId_pk"}),
]);

export const postsToAuthors = pgTable("posts_to_authors", {
	postId: uuid().notNull(),
	authorId: uuid().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "posts_to_authors_postId_posts_id_fk"
		}),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [authors.id],
			name: "posts_to_authors_authorId_authors_id_fk"
		}),
	primaryKey({ columns: [table.postId, table.authorId], name: "posts_to_authors_postId_authorId_pk"}),
]);
