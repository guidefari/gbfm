import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { createMigratedD1Database, d1MigrationFiles } from './migrate-d1'

const directory = path.dirname(fileURLToPath(import.meta.url))
const migrationsDirectory = path.resolve(directory, '../../drizzle-d1')

describe('migrated D1 test database', () => {
  test('keeps the deploy directory flat and aligned with the replay list', () => {
    const sqlFiles = readdirSync(migrationsDirectory)
      .filter((name) => name.endsWith('.sql'))
      .sort()

    expect(existsSync(path.join(migrationsDirectory, 'meta', '_journal.json'))).toBe(false)
    expect(sqlFiles).toEqual([...d1MigrationFiles])
  })

  test('releases its Miniflare runtime when disposed', async () => {
    await using resource = await createMigratedD1Database([])

    await expect(resource.database.prepare('SELECT 1').first()).resolves.toBeDefined()
    await resource.dispose()

    expect(() => resource.database.prepare('SELECT 1').first()).toThrow('poisoned stub')
  })
})
