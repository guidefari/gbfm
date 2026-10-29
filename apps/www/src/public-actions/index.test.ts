import { expect, test } from 'vitest'

import { init, Message, update } from './index'

test('late mutations cannot update a different resource or resource kind', () => {
  const current = update(
    init(
      {
        target: { id: 'same-id', kind: 'show' },
        path: '/shows/current',
        state: 'inactive',
      },
      'user-1',
    ),
    Message.Toggle(),
  ).model

  expect(
    update(
      current,
      Message.Saved({
        target: { id: 'same-id', kind: 'audio' },
        active: true,
        principalId: 'user-1',
        requestId: current.requestId,
      }),
    ).model,
  ).toEqual(current)
  expect(
    update(
      current,
      Message.Failed({
        target: { id: 'other-id', kind: 'show' },
        unauthorized: true,
        principalId: 'user-1',
        requestId: current.requestId,
      }),
    ).model,
  ).toEqual(current)
})

test('failed mutations retain saved state, duplicate clicks do not queue requests, expired sessions require sign-in', () => {
  const current = init(
    {
      target: { id: 'mix-id', kind: 'audio' },
      path: '/mixes/current',
      state: 'active',
    },
    'user-1',
  )

  const pending = update(current, Message.Toggle())
  expect(pending.model.busy).toBe(true)
  expect(update(pending.model, Message.Toggle()).commands).toBeUndefined()

  const failed = update(
    pending.model,
    Message.Failed({
      target: { id: 'mix-id', kind: 'audio' },
      unauthorized: false,
      principalId: 'user-1',
      requestId: pending.model.requestId,
    }),
  ).model

  expect(failed.document?.state).toBe('active')
  expect(failed.busy).toBe(false)
  const retried = update(failed, Message.Toggle()).model

  expect(
    update(
      retried,
      Message.Failed({
        target: { id: 'mix-id', kind: 'audio' },
        unauthorized: true,
        principalId: 'user-1',
        requestId: retried.requestId,
      }),
    ).model.document?.state,
  ).toBe('anonymous')
})
