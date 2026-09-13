import { describe, expect, test } from 'vitest'
import { createMigratedD1Database } from './migrate-d1'

describe('migrated D1 test database', () => {
  test('releases its Miniflare runtime when disposed', async () => {
    await using resource = await createMigratedD1Database([])

    await expect(resource.database.prepare('SELECT 1').first()).resolves.toBeDefined()
    await resource.dispose()

    expect(() => resource.database.prepare('SELECT 1').first()).toThrow('poisoned stub')
  })
})
