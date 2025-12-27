import { and, eq } from 'drizzle-orm'
import { Effect, Console } from 'effect'
import { BunRuntime } from '@effect/platform-bun'
import { db } from '../src/db'
import type { InsertPermission, InsertRole } from '../src/db/rbac.schema'
import {
  permissionsTable,
  rolePermissionsTable,
  rolesTable,
  userRolesTable
} from '../src/db/rbac.schema'
import { user as usersTable } from '../src/db/auth.schema'

const roles: InsertRole[] = [
  {
    name: 'admin',
    description: 'Full system administration access'
  },
  {
    name: 'editor',
    description: 'Content management and publishing'
  },
  {
    name: 'creator',
    description: 'Content creation and editing'
  }
]

const resources = ['audio', 'post', 'mix', 'release', 'label', 'publication', 'user']

const adminPermissions: InsertPermission[] = resources.map((resource) => ({
  name: `manage:${resource}`,
  resource,
  action: 'manage',
  description: `Full management access to ${resource} resources`
}))

const editorPermissions: InsertPermission[] = [
  ...resources
    .filter((r) => r !== 'user')
    .flatMap((resource) => [
      {
        name: `create:${resource}`,
        resource,
        action: 'create',
        description: `Create ${resource} resources`
      },
      {
        name: `read:${resource}`,
        resource,
        action: 'read',
        description: `Read ${resource} resources`
      },
      {
        name: `update:${resource}`,
        resource,
        action: 'update',
        description: `Update ${resource} resources`
      },
      {
        name: `delete:${resource}`,
        resource,
        action: 'delete',
        description: `Delete ${resource} resources`
      },
      {
        name: `publish:${resource}`,
        resource,
        action: 'publish',
        description: `Publish ${resource} resources`
      }
    ]),
  {
    name: 'read:user',
    resource: 'user',
    action: 'read',
    description: 'Read user resources'
  }
]

const creatorPermissions: InsertPermission[] = [
  ...resources
    .filter((r) => !['user', 'publication'].includes(r))
    .flatMap((resource) => [
      {
        name: `create:${resource}`,
        resource,
        action: 'create',
        description: `Create ${resource} resources`
      },
      {
        name: `read:${resource}`,
        resource,
        action: 'read',
        description: `Read ${resource} resources`
      },
      {
        name: `update:${resource}`,
        resource,
        action: 'update',
        description: `Update ${resource} resources`
      },
      {
        name: `delete:${resource}`,
        resource,
        action: 'delete',
        description: `Delete ${resource} resources`
      }
    ]),
  {
    name: 'read:publication',
    resource: 'publication',
    action: 'read',
    description: 'Read publication resources'
  },
  {
    name: 'read:user',
    resource: 'user',
    action: 'read',
    description: 'Read user resources'
  }
]

const allPermissions = [...adminPermissions, ...editorPermissions, ...creatorPermissions]

async function createRoles() {
  console.log(`Creating ${roles.length} roles...`)
  const insertedRoles: Array<typeof rolesTable.$inferSelect> = []

  for (const role of roles) {
    const [insertedRole] = await db
      .insert(rolesTable)
      .values(role)
      .onConflictDoNothing()
      .returning()

    if (insertedRole) {
      console.log(`  ✅ Created role: ${role.name}`)
      insertedRoles.push(insertedRole)
    } else {
      const [existingRole] = await db
        .select()
        .from(rolesTable)
        .where(eq(rolesTable.name, role.name))
        .limit(1)

      if (!existingRole) {
        throw new Error(`Role not found after conflict: ${role.name}`)
      }

      console.log(`  ⏭️  Role already exists: ${role.name}`)
      insertedRoles.push(existingRole)
    }
  }

  return insertedRoles
}

async function createPermissions() {
  console.log(`Creating ${allPermissions.length} permissions...`)
  const insertedPermissions: Array<typeof permissionsTable.$inferSelect> = []

  for (const permission of allPermissions) {
    const [insertedPermission] = await db
      .insert(permissionsTable)
      .values(permission)
      .onConflictDoNothing()
      .returning()

    if (insertedPermission) {
      console.log(`  ✅ Created permission: ${permission.name}`)
      insertedPermissions.push(insertedPermission)
    } else {
      const [existingPermission] = await db
        .select()
        .from(permissionsTable)
        .where(eq(permissionsTable.name, permission.name))
        .limit(1)

      if (!existingPermission) {
        throw new Error(`Permission not found after conflict: ${permission.name}`)
      }

      console.log(`  ⏭️  Permission already exists: ${permission.name}`)
      insertedPermissions.push(existingPermission)
    }
  }

  return insertedPermissions
}

async function assignPermissionsToRoles(
  insertedRoles: Array<typeof rolesTable.$inferSelect>,
  insertedPermissions: Array<typeof permissionsTable.$inferSelect>
) {
  console.log('Assigning permissions to roles...')

  const adminRole = insertedRoles.find((r) => r.name === 'admin')
  const editorRole = insertedRoles.find((r) => r.name === 'editor')
  const creatorRole = insertedRoles.find((r) => r.name === 'creator')

  if (!adminRole || !editorRole || !creatorRole) {
    throw new Error('One or more roles not found')
  }

  const rolePermissionMap = [
    {
      role: adminRole,
      permissionNames: adminPermissions.map((p) => p.name)
    },
    {
      role: editorRole,
      permissionNames: editorPermissions.map((p) => p.name)
    },
    {
      role: creatorRole,
      permissionNames: creatorPermissions.map((p) => p.name)
    }
  ]

  for (const { role, permissionNames } of rolePermissionMap) {
    console.log(`\nAssigning permissions to ${role.name} role...`)
    let assigned = 0
    let skipped = 0

    for (const permissionName of permissionNames) {
      const permission = insertedPermissions.find((p) => p.name === permissionName)

      if (!permission) {
        console.warn(`  ⚠️  Permission not found: ${permissionName}`)
        continue
      }

      const [existing] = await db
        .select()
        .from(rolePermissionsTable)
        .where(
          and(
            eq(rolePermissionsTable.roleId, role.id),
            eq(rolePermissionsTable.permissionId, permission.id)
          )
        )
        .limit(1)

      if (!existing) {
        await db.insert(rolePermissionsTable).values({
          roleId: role.id,
          permissionId: permission.id
        })
        assigned++
      } else {
        skipped++
      }
    }

    console.log(`  📊 Summary for ${role.name}: Assigned: ${assigned}, Skipped: ${skipped}`)
  }
}

async function assignCreatorToExistingUsers(creatorRoleId: string) {
  console.log('\nAssigning Creator role to existing users...')

  const allUsers = await db.select().from(usersTable)
  console.log(`Found ${allUsers.length} existing users`)

  let assigned = 0
  let skipped = 0

  for (const user of allUsers) {
    const [existingRole] = await db
      .select()
      .from(userRolesTable)
      .where(
        and(
          eq(userRolesTable.userId, user.id),
          eq(userRolesTable.roleId, creatorRoleId)
        )
      )
      .limit(1)

    if (!existingRole) {
      await db.insert(userRolesTable).values({
        userId: user.id,
        roleId: creatorRoleId,
        assignedBy: null
      })
      console.log(`  ✅ Assigned Creator role to: ${user.email}`)
      assigned++
    } else {
      skipped++
    }
  }

  console.log(`\n📊 Summary: Assigned: ${assigned}, Skipped: ${skipped}`)
}

const seedRBAC = Effect.gen(function* (_) {
  yield* _(Console.log('🌱 Starting RBAC seeding...\n'))

  yield* _(Console.log('📝 Step 1/4: Creating roles...'))
  const insertedRoles = yield* _(Effect.promise(() => createRoles()))

  yield* _(Console.log('\n📝 Step 2/4: Creating permissions...'))
  const insertedPermissions = yield* _(Effect.promise(() => createPermissions()))

  yield* _(Console.log('\n📝 Step 3/4: Assigning permissions to roles...'))
  yield* _(Effect.promise(() => assignPermissionsToRoles(insertedRoles, insertedPermissions)))

  yield* _(Console.log('\n📝 Step 4/4: Assigning Creator role to existing users...'))
  const creatorRole = insertedRoles.find((r) => r.name === 'creator')
  if (!creatorRole) {
    return yield* _(Effect.fail(new Error('Creator role not found')))
  }
  yield* _(Effect.promise(() => assignCreatorToExistingUsers(creatorRole.id)))

  yield* _(Console.log('\n✅ RBAC seeding complete!'))
}).pipe(
  Effect.catchAll((error) =>
    Console.error(`❌ RBAC seeding failed: ${error}`).pipe(
      Effect.flatMap(() => Effect.fail(error))
    )
  )
)

seedRBAC.pipe(BunRuntime.runMain)
