import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { emptyDocument, parseDashboardDocument } from './document'
import { init, initialModel } from './init'
import { Message } from './message'
import { endpointFor } from './section'
import { update } from './update'

const member = { id: 'user-1', role: 'user' as const }

describe('dashboard submodel', () => {
  it('uses existing account and admin endpoints', () => {
    expect(endpointFor('profile')).toBe('/api/user/profile')
    expect(endpointFor('content/mixes')).toContain('/api/content/audio/mix/manage')
    expect(endpointFor('frontend-errors')).toBe('/api/admin/telemetry')
  })

  it('encodes user searches and preserves requested pagination when the API omits its offset', async () => {
    const path = endpointFor(
      'users',
      new URLSearchParams({ search: ' dj+test@example.com ', offset: '25' }),
    )

    expect(path).toBe(
      '/auth/admin/list-users?limit=25&offset=25&searchField=email&searchValue=dj%2Btest%40example.com',
    )

    const document = await Effect.runPromise(
      parseDashboardDocument(path ?? '', { users: [], total: 27, limit: 25 }),
    )

    expect(document.fields).toEqual({ search: 'dj+test@example.com', offset: '25' })

    for (const offset of ['-1', '1.5', 'NaN', 'Infinity']) {
      expect(endpointFor('users', new URLSearchParams({ offset }))).toBe(
        '/auth/admin/list-users?limit=25&offset=0',
      )
    }
  })

  it('does not issue an admin request for a non-admin principal', () => {
    const result = init('users', member)()
    expect(result.model).toMatchObject({ phase: 'error', error: 'Administrator access required.' })
    expect(result.commands).toBeUndefined()
  })

  it('turns profile saves into a real profile API command', () => {
    const model = {
      ...initialModel('profile', member),
      phase: 'ready' as const,
      fields: { email: 'listener@example.com' },
    }

    const result = update(model, Message.SaveProfile())
    expect(result.commands?.[0]).toMatchObject({
      name: 'DashboardWrite',
      args: { path: '/api/user/profile', method: 'PATCH' },
    })
  })

  it('lets an admin replace an unpublished featured mix with automatic selection', async () => {
    const document = await Effect.runPromise(
      parseDashboardDocument('/api/admin/featured-mix', {
        mixId: 'retired',
        unavailableTitle: 'Retired mix',
        mixes: [{ id: 'newest', title: 'Newest mix' }],
      }),
    )

    expect(document.fields).toEqual({
      mixId: 'retired',
      savedMixId: 'retired',
      unavailableTitle: 'Retired mix',
    })
    expect(document.rows.map(({ id }) => id)).toEqual(['newest'])

    const loaded = update(
      initialModel('featured-mix', { id: 'admin-1', role: 'admin' }),
      Message.Loaded({ document }),
    ).model

    const automatic = update(loaded, Message.FieldChanged({ name: 'mixId', value: '' })).model

    expect(automatic.fields.mixId).not.toBe(automatic.fields.savedMixId)
    expect(update(automatic, Message.SaveFeaturedMix()).commands?.[0]).toMatchObject({
      name: 'DashboardWrite',
      args: {
        path: '/api/admin/featured-mix',
        method: 'PUT',
        body: JSON.stringify({ mixId: null }),
      },
    })
  })

  it('preserves empty and loaded collection states', () => {
    const model = initialModel('reminders', member)
    expect(update(model, Message.Loaded({ document: emptyDocument })).model).toMatchObject({
      phase: 'ready',
      rows: [],
    })
    expect(
      update(
        model,
        Message.Loaded({
          document: {
            ...emptyDocument,
            rows: [{ id: 'r1', title: 'Album', detail: 'Artist', href: null, actionId: 'r1' }],
          },
        }),
      ).model.rows[0],
    ).toMatchObject({ id: 'r1', title: 'Album', detail: 'Artist' })
  })
})
