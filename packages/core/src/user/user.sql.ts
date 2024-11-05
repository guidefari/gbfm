import { db } from "@/drizzle";
import { sql } from "drizzle-orm";
// import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle"
import {
	boolean,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";

// export const roleEnum = pgEnum("role", ["user", "admin"]);

export const userTable = pgTable(
	"users",
	{
		id: text().primaryKey(),
		username: varchar().unique(),
		email: varchar().notNull().unique(),
		password: varchar(),
		firstname: varchar(),
		lastname: varchar(),
		// role: roleEnum("role").notNull().default("user"),
		isDeleted: boolean().default(false),
		isVerified: boolean().default(false),
		createdAt: timestamp().defaultNow().notNull(),
		updatedAt: timestamp().defaultNow().notNull(),
	},
	(users) => ({
		usernameIndex: uniqueIndex("username_idx").on(users.username),
		emailIndex: uniqueIndex("email_idx").on(users.email),
	}),
);

export type User = typeof userTable.$inferSelect;
export type NewUser = typeof userTable.$inferInsert;

export const sessionTable = pgTable("sessions", {
	id: text().primaryKey(),
	userId: text()
		.notNull()
		.references(() => userTable.id),
	expiresAt: timestamp({
		withTimezone: true,
		mode: "date",
	}).notNull(),
});

// TODO: go for inference here?
export const insertUser = async (user: NewUser) => {
	return db.insert(userTable).values(user).returning();
};

export const emailSchema = z.string().email();
export const usernameSchema = z.string().min(3).max(64);
