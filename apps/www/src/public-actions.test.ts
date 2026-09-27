import { expect, test } from 'vitest'

import { init, Message, update } from './public-actions'

test('late mutations cannot update a different resource or resource kind', () => {
  const current = init({
    target: { id: 'same-id', kind: 'show' },
    path: '/shows/current',
    state: 'inactive',
  })

  expect(
    update(current, Message.Saved({ target: { id: 'same-id', kind: 'audio' }, active: true }))
      .model,
  ).toEqual(current)
  expect(
    update(
      current,
      Message.Failed({ target: { id: 'other-id', kind: 'show' }, unauthorized: true }),
    ).model,
  ).toEqual(current)
})

test('failed mutations retain saved state, duplicate clicks do not queue requests, expired sessions require sign-in', () => {
  const current = init({
    target: { id: 'mix-id', kind: 'audio' },
    path: '/mixes/current',
    state: 'active',
  })

  const pending = update(current, Message.Toggle())
  expect(pending.model.busy).toBe(true)
  expect(update(pending.model, Message.Toggle()).commands).toBeUndefined()

  const failed = update(
    pending.model,
    Message.Failed({ target: { id: 'mix-id', kind: 'audio' }, unauthorized: false }),
  ).model

  expect(failed.document?.state).toBe('active')
  expect(failed.busy).toBe(false)
  expect(
    update(failed, Message.Failed({ target: { id: 'mix-id', kind: 'audio' }, unauthorized: true }))
      .model.document?.state,
  ).toBe('anonymous')
})
