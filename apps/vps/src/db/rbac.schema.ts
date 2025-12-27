import { z } from '@hono/zod-openapi'
import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'
import { user } from './auth.schema'

// Roles table (lookup table approach - no enum)
export const rolesTable = pgTable('roles', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 50 }).notNull().unique(),
  description: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
})

// Permissions table
export const permissionsTable = pgTable('permissions', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 100 }).notNull().unique(),
  resource: varchar({ length: 50 }).notNull(), // e.g., 'post', 'audio', 'release'
  action: varchar({ length: 50 }).notNull(), // e.g., 'create', 'read', 'update', 'delete'
  description: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
})

// User-Role junction table (many-to-many)
export const userRolesTable = pgTable(
  'user_roles',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: uuid()
      .notNull()
      .references(() => rolesTable.id, { onDelete: 'cascade' }),
    assignedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    assignedBy: text().references(() => user.id)
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })]
)

// Role-Permission junction table (many-to-many)
export const rolePermissionsTable = pgTable(
  'role_permissions',
  {
    roleId: uuid()
      .notNull()
      .references(() => rolesTable.id, { onDelete: 'cascade' }),
    permissionId: uuid()
      .notNull()
      .references(() => permissionsTable.id, { onDelete: 'cascade' }),
    grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })]
)

// Direct user permissions (for special cases, bypassing roles)
export const userPermissionsTable = pgTable(
  'user_permissions',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    permissionId: uuid()
      .notNull()
      .references(() => permissionsTable.id, { onDelete: 'cascade' }),
    grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    grantedBy: text().references(() => user.id)
  },
  (t) => [primaryKey({ columns: [t.userId, t.permissionId] })]
)

// Type exports
export type SelectRole = InferSelectModel<typeof rolesTable>
export type InsertRole = InferInsertModel<typeof rolesTable>
export type SelectPermission = InferSelectModel<typeof permissionsTable>
export type InsertPermission = InferInsertModel<typeof permissionsTable>
export type SelectUserRole = InferSelectModel<typeof userRolesTable>
export type InsertUserRole = InferInsertModel<typeof userRolesTable>
export type SelectRolePermission = InferSelectModel<typeof rolePermissionsTable>
export type InsertRolePermission = InferInsertModel<typeof rolePermissionsTable>
export type SelectUserPermission = InferSelectModel<typeof userPermissionsTable>
export type InsertUserPermission = InferInsertModel<typeof userPermissionsTable>

// Zod schemas for API validation
export const selectRoleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const insertRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional()
})

export const updateRoleSchema = insertRoleSchema.partial()

export const selectPermissionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  resource: z.string(),
  action: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const insertPermissionSchema = z.object({
  name: z.string().min(1).max(100),
  resource: z.string().min(1).max(50),
  action: z.enum(['create', 'read', 'update', 'delete', 'publish', 'manage']),
  description: z.string().optional()
})

export const updatePermissionSchema = insertPermissionSchema.partial()

export const assignRoleSchema = z.object({
  userId: z.string(),
  roleId: z.uuid()
})

export const assignPermissionSchema = z.object({
  userId: z.string(),
  permissionId: z.uuid()
})

// Relations
export const rolesRelations = relations(rolesTable, ({ many }) => ({
  userRoles: many(userRolesTable),
  rolePermissions: many(rolePermissionsTable)
}))

export const permissionsRelations = relations(permissionsTable, ({ many }) => ({
  rolePermissions: many(rolePermissionsTable),
  userPermissions: many(userPermissionsTable)
}))

export const userRolesRelations = relations(userRolesTable, ({ one }) => ({
  user: one(user, {
    fields: [userRolesTable.userId],
    references: [user.id]
  }),
  role: one(rolesTable, {
    fields: [userRolesTable.roleId],
    references: [rolesTable.id]
  })
}))

export const rolePermissionsRelations = relations(
  rolePermissionsTable,
  ({ one }) => ({
    role: one(rolesTable, {
      fields: [rolePermissionsTable.roleId],
      references: [rolesTable.id]
    }),
    permission: one(permissionsTable, {
      fields: [rolePermissionsTable.permissionId],
      references: [permissionsTable.id]
    })
  })
)

export const userPermissionsRelations = relations(
  userPermissionsTable,
  ({ one }) => ({
    user: one(user, {
      fields: [userPermissionsTable.userId],
      references: [user.id]
    }),
    permission: one(permissionsTable, {
      fields: [userPermissionsTable.permissionId],
      references: [permissionsTable.id]
    })
  })
)
