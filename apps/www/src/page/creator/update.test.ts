import { describe, expect, it } from 'vitest'

import { init, initialModel } from './init'
import { Message } from './message'
import { update } from './update'

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

  it('invalid episode input blocks writes until corrected, including after other fields change', () => {
    const model = initialModel({ ...input, kind: 'mix' })

    for (const value of ['0', '-2', '1.5', 'Infinity', 'NaN']) {
      const invalid = update(model, Message.EpisodeChanged({ value })).model
      const edited = update(invalid, Message.Changed({ field: 'title', value: 'A mix' })).model
      expect(edited.episodeError).toBe('Episode number must be a positive whole number.')
      expect(update(edited, Message.PublishRequested()).commands).toBeUndefined()
      expect(update(edited, Message.DraftSaveRequested()).commands).toBeUndefined()
      const corrected = update(edited, Message.EpisodeChanged({ value: '7' })).model
      expect(corrected.draft.episodeNumber).toBe(7)
      expect(update(corrected, Message.PublishRequested()).commands).toHaveLength(1)
    }
  })

  it('keeps quoted posts immutable when editing and removes both sides of a music attachment', () => {
    const model = initialModel({ ...input, editSlug: 'existing-tweet' })
    expect(update(model, Message.QuoteChanged({ value: 'other-post' }))).toEqual({ model })

    const url = 'https://open.spotify.com/album/fixture'
    const entered = update(model, Message.Changed({ field: 'musicUrl', value: url })).model
    const resolved = Message.MusicResolved({ entityType: 'album', entityId: 'album-1', url })
    const attached = update(entered, resolved).model
    expect(attached.draft.musicEntityId).toBe('album-1')
    const removed = update(attached, Message.MusicRemoved()).model

    expect(removed.draft).toMatchObject({
      musicUrl: '',
      musicEntityType: null,
      musicEntityId: null,
    })
    expect(update(removed, resolved).model).toBe(removed)
  })

  it('the pause checkpoint wins over delayed progress events', () => {
    const model = { ...initialModel(input), uploadState: 'pausing' as const, uploadPercent: 0 }
    const paused = update(model, Message.UploadPaused({ percent: 36 })).model
    expect(paused.uploadPercent).toBe(36)
    expect(update(paused, Message.UploadProgressed({ percent: 0 })).model.uploadPercent).toBe(36)
    expect(update(paused, Message.UploadResumeRequested()).commands?.[0]?.name).toBe(
      'Creator.UploadAudio',
    )
  })
})
