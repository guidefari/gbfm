import { describe, expect, test } from 'vitest'
import { sanitizeDatabaseSpan, summarizeDatabaseQuery } from './database-telemetry'

describe('summarizeDatabaseQuery', () => {
  test.each([
    ['select "audio"."id" from "audio" where "creatorId" = $1', 'SELECT audio'],
    ['insert into "music_reminder" ("id") values ($1)', 'INSERT music_reminder'],
    ['update public."shows" set "title" = $1', 'UPDATE shows'],
    ['delete from "post_creators" where "postId" = $1', 'DELETE post_creators'],
    ['with matching as (select "id" from "audio") update "shows" set "title" = $1', 'UPDATE shows'],
    [
      'with recursive tree as (select "id" from "shows") delete from "shows" where "id" = $1',
      'DELETE shows'
    ]
  ])('summarizes %s without values', (query, description) => {
    expect(summarizeDatabaseQuery(query).description).toBe(description)
  })
})

describe('sanitizeDatabaseSpan', () => {
  test('replaces SQL and parameter attributes with safe low-cardinality fields', () => {
    const span = sanitizeDatabaseSpan({
      op: 'default',
      description: 'select "audio"."id" from "audio" where "creatorId" = $1',
      data: {
        'db.system': 'postgresql',
        'gbfm.db.instrumentation': 'manual',
        'db.statement': 'select "audio"."id" from "audio" where "creatorId" = $1',
        'db.query.text': 'select "audio"."id" from "audio" where "creatorId" = $1',
        'db.query.parameters': 'secret-user-id',
        'db.operation.parameters': 'another-secret',
        'db.query.parameter.0': 'one-more-secret',
        'server.address': 'database.internal'
      }
    })

    expect(span).toEqual({
      op: 'db.query',
      description: 'SELECT audio',
      data: {
        'db.system': 'postgresql',
        'gbfm.db.instrumentation': 'manual',
        'server.address': 'database.internal',
        'sentry.op': 'db.query',
        'db.system.name': 'postgresql',
        'db.operation.name': 'SELECT',
        'db.collection.name': 'audio',
        'db.query.summary': 'SELECT audio'
      }
    })
    expect(JSON.stringify(span)).not.toContain('secret-user-id')
    expect(JSON.stringify(span)).not.toContain('another-secret')
    expect(JSON.stringify(span)).not.toContain('one-more-secret')
    expect(JSON.stringify(span)).not.toContain('creatorId')
  })

  test('extracts SQL text from query config objects without retaining values', () => {
    const span = sanitizeDatabaseSpan({
      data: {
        'db.system.name': 'postgresql',
        'db.query': {
          text: 'insert into "music_reminder" ("id") values ($1)',
          values: ['secret-reminder-id']
        }
      }
    })

    expect(span).toMatchObject({
      description: 'INSERT music_reminder',
      data: { 'db.collection.name': 'music_reminder' }
    })
    expect(JSON.stringify(span)).not.toContain('secret-reminder-id')
  })

  test('preserves the instrumented database system instead of relabelling it', () => {
    const span = sanitizeDatabaseSpan({
      description: 'select value from cache',
      data: { 'db.system': 'redis' }
    })

    expect(span).toMatchObject({
      data: {
        'db.system': 'redis',
        'db.system.name': 'redis'
      }
    })
  })

  test('leaves non-database spans unchanged', () => {
    const span = { op: 'http.server', description: 'GET /health', data: {} }
    expect(sanitizeDatabaseSpan(span)).toBe(span)
  })
})
