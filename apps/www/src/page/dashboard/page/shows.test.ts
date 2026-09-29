import { expect, test } from 'vitest'

import { initialModel, Message, update } from './shows'

test('show deletion requires selecting an existing show and explicit confirmation', () => {
  expect(update(initialModel, Message.ConfirmDelete()).commands).toBeUndefined()
  expect(update(initialModel, Message.AskDelete({ slug: 'missing' })).model.deleting).toBeNull()
  const selected = { ...initialModel, deleting: 'a-show' }
  const cancelled = update(selected, Message.CancelDelete()).model
  expect(update(cancelled, Message.ConfirmDelete()).commands).toBeUndefined()
  const deletion = update(selected, Message.ConfirmDelete())
  expect(deletion.commands?.[0]).toMatchObject({ name: 'Shows.Delete', args: { slug: 'a-show' } })
  expect(update(deletion.model, Message.ConfirmDelete()).commands).toBeUndefined()
})

test('saving locks the submitted form and a failure preserves the original edit for retry', () => {
  const editing = {
    ...initialModel,
    editing: 'original-slug',
    draft: false,
    form: { ...initialModel.form, title: 'A new title', slug: 'renamed-slug' },
  }

  const saving = update(editing, Message.Save())
  expect(saving.commands?.[0]).toMatchObject({
    name: 'Shows.Save',
    args: { editing: 'original-slug', form: { slug: 'renamed-slug' }, draft: false },
  })
  expect(update(saving.model, Message.Clear()).model).toEqual(saving.model)
  expect(update(saving.model, Message.Save()).commands).toBeUndefined()
  const failed = update(saving.model, Message.Failed({ message: 'Unavailable' })).model
  expect(failed).toMatchObject({
    form: editing.form,
    editing: 'original-slug',
    busy: false,
    error: 'Unavailable',
  })
  expect(update(failed, Message.Save()).commands).toHaveLength(1)
})
