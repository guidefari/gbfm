import { describe, expect, it } from 'vitest'

import { emptyDocument } from './document'
import { endpointFor, init, initialModel, Message, update } from './model'

const member = { id: 'user-1', role: 'user' as const }

describe('dashboard submodel', () => {
  it('uses existing account and admin endpoints', () => {
    expect(endpointFor('profile')).toBe('/api/user/profile')
    expect(endpointFor('content/mixes')).toContain('/api/content/audio/mix/manage')
    expect(endpointFor('frontend-errors')).toBe('/api/admin/telemetry')
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
