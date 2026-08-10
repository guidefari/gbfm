import { describe, expect, test } from 'vitest'
import { withoutDatabaseAutoInstrumentation } from './sentry'

describe('withoutDatabaseAutoInstrumentation', () => {
  test('removes database integrations while preserving the remaining defaults', () => {
    const integrations = [
      { name: 'Http' },
      { name: 'Postgres' },
      { name: 'PostgresJs' },
      { name: 'OnUncaughtException' }
    ]

    expect(withoutDatabaseAutoInstrumentation(integrations)).toEqual([
      { name: 'Http' },
      { name: 'OnUncaughtException' }
    ])
  })
})
