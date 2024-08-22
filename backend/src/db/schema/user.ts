import {
  boolean,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"

export const roleEnum = pgEnum("role", ["user", "admin"])

export const user = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username").notNull().unique(),
    password: varchar("password").notNull(),
    firstname: varchar("firstname"),
    lastname: varchar("lastname"),
    role: roleEnum("role").notNull().default("user"),
    isDeleted: boolean("is_deleted").default(false),
    email: varchar("email", {}).notNull().unique(),
    createdAt: timestamp("created_at")
      .$default(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", {})
      .$default(() => new Date())
      .notNull(),
  },
  users => ({
    usernameIndex: uniqueIndex("username_idx").on(users.username),
    emailIndex: uniqueIndex("email_idx").on(users.email),
  })
)

export type User = typeof user.$inferSelect
export type NewUser = typeof user.$inferInsert

export const sessionTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => user.id),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
})