import { describe, expect, test } from 'vitest'
import { sanitizeDatabaseSpan, summarizeDatabaseQuery } from './database-telemetry'

describe('summarizeDatabaseQuery', () => {
  test.each([
    ['select "audio"."id" from "audio" where "creatorId" = $1', 'SELECT audio'],
    ['insert into "music_reminder" ("id") values ($1)', 'INSERT music_reminder'],
    ['update public."shows" set "title" = $1', 'UPDATE shows'],
    ['delete from "post_creators" where "postId" = $1', 'DELETE post_creators']
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
        'db.statement': 'select "audio"."id" from "audio" where "creatorId" = $1',
        'db.query.text': 'select "audio"."id" from "audio" where "creatorId" = $1',
        'db.query.parameters': 'secret-user-id',
        'server.address': 'database.internal'
      }
    })

    expect(span).toEqual({
      op: 'db.query',
      description: 'SELECT audio',
      data: {
        'db.system': 'postgresql',
        'server.address': 'database.internal',
        'sentry.op': 'db.query',
        'db.system.name': 'postgresql',
        'db.operation.name': 'SELECT',
        'db.collection.name': 'audio',
        'db.query.summary': 'SELECT audio'
      }
    })
    expect(JSON.stringify(span)).not.toContain('secret-user-id')
    expect(JSON.stringify(span)).not.toContain('creatorId')
  })

  test('leaves non-database spans unchanged', () => {
    const span = { op: 'http.server', description: 'GET /health', data: {} }
    expect(sanitizeDatabaseSpan(span)).toBe(span)
  })
})
