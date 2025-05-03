import { pgTable, varchar, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { postsToAuthors } from "./post.schema";
import { mixesToAuthors } from "./mix.schema";

export const authorsTable = pgTable("authors", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  username: varchar({ length: 255 }).unique(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }),
  verified: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const zAuthorSchema = createSelectSchema(authorsTable);

export const authorsRelations = relations(authorsTable, ({ many }) => ({
    postsToAuthors: many(postsToAuthors),
    mixesToAuthors: many(mixesToAuthors),
  }));