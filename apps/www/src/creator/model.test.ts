import { describe, expect, it } from 'vitest'

import { Message, init, initialModel, update } from './model'

describe('creator model', () => {
  const input = { kind: 'micro' as const, editSlug: null, creatorId: 'user-1', authorized: true }

  it('initializes with a named hydration command', () => {
    const result = init(input)
    expect(result.model.phase).toBe('loading')
    expect(result.commands?.[0]?.name).toBe('Creator.Hydrate')
  })

  it('autosaves every writing change to the scoped local draft', () => {
    const model = { ...initialModel(input), phase: 'writing' as const }
    const result = update(model, Message.Changed({ field: 'title', value: 'Night music' }))
    expect(result.model.draft.title).toBe('Night music')
    expect(result.model.saveState).toBe('unsaved')
    expect(result.commands?.[0]?.name).toBe('Creator.PersistDraft')
  })

  it('guards save and publish transitions independently of the view', () => {
    const model = initialModel({ ...input, authorized: false })
    expect(update(model, Message.PublishRequested()).model.phase).toBe('forbidden')
    expect(update(model, Message.DraftSaveRequested()).commands).toBeUndefined()
  })

  it('opens review before publishing and preserves the selected type', () => {
    const model = initialModel(input)
    const typed = update(model, Message.KindChanged({ kind: 'post' })).model
    const reviewed = update(typed, Message.ReviewRequested()).model
    expect(reviewed.phase).toBe('reviewing')
    expect(reviewed.draft.kind).toBe('post')
  })

  it('an autosave completion cannot dismiss review or roll back publication', () => {
    const model = initialModel(input)
    const reviewed = update(model, Message.ReviewRequested()).model
    const saved = update(reviewed, Message.LocallySaved()).model
    expect(saved.phase).toBe('reviewing')
    expect(saved.saveState).toBe('saved-locally')
    const published = update(saved, Message.Saved({ slug: 'published', published: true })).model
    expect(update(published, Message.LocallySaved()).model).toEqual(published)
  })

  it('editing cannot switch between post and audio endpoints', () => {
    const model = initialModel({ ...input, kind: 'mix', editSlug: 'existing-mix' })
    expect(update(model, Message.KindChanged({ kind: 'post' }))).toEqual({ model })
  })
})
