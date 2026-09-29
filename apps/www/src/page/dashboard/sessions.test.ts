import { describe, expect, it } from 'vitest'

import { Message, initialModel, update } from './sessions'

describe('session administration', () => {
  const user = { id: 'one', name: 'One', email: 'one@example.test' }

  it('requires confirmation before issuing revoke-all and keeps the selected account in the command', () => {
    const model = { ...initialModel, selected: user }
    expect(update(model, Message.Revoke({ sessionId: null })).commands).toBeUndefined()
    const confirmed = update(model, Message.ConfirmAll()).model
    const command = update(confirmed, Message.Revoke({ sessionId: null })).commands?.[0]
    expect(command).toMatchObject({
      name: 'AdminSessions.Revoke',
      args: { userId: 'one', sessionId: null },
    })
  })

  it('ignores results and failures after the search or selected account changes', () => {
    const selected = update(initialModel, Message.UserSelected({ user })).model
    const changed = update(selected, Message.QueryChanged({ query: 'two@example.test' })).model
    expect(
      update(changed, Message.Failed({ revision: selected.revision, message: 'Old failure' }))
        .model,
    ).toEqual(changed)
    expect(
      update(
        changed,
        Message.SessionsLoaded({ revision: selected.revision, sessions: [], revoked: true }),
      ).model,
    ).toEqual(changed)
    expect(
      update(changed, Message.UsersLoaded({ revision: selected.revision, users: [user] })).model,
    ).toEqual(changed)
  })
})
