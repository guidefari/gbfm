import { describe, expect, it } from 'vitest'

import { init, initialModel } from './init'
import { Message } from './message'
import { draftValidationError } from './model'
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

  it('keeps author IDs internal and preserves restored collaborators until explicitly removed', () => {
    const initial = initialModel(input)

    const restored = update(
      initial,
      Message.Hydrated({
        draft: { ...initial.draft, creatorIds: ['user-1', 'unknown-restored'] },
        creators: [],
      }),
    ).model

    const queried = update(restored, Message.AuthorQueryChanged({ value: 'Ada' })).model
    const creator = { id: 'collaborator', name: 'Ada', username: 'ada' }
    const found = update(queried, Message.AuthorsFound({ query: 'Ada', creators: [creator] })).model
    const selected = update(found, Message.AuthorSelected({ id: creator.id })).model
    expect(selected.draft.creatorIds).toEqual(['user-1', 'unknown-restored', 'collaborator'])
    expect(selected.creators).toEqual([creator])
    expect(update(selected, Message.AuthorSelected({ id: creator.id })).model).toEqual(selected)
    expect(update(selected, Message.AuthorSelected({ id: 'not-a-search-result' })).model).toEqual(
      selected,
    )
    const removed = update(selected, Message.AuthorRemoved({ id: 'unknown-restored' })).model
    expect(removed.draft.creatorIds).toEqual(['user-1', 'collaborator'])
    const sole = update(removed, Message.AuthorRemoved({ id: 'user-1' })).model
    expect(
      update(sole, Message.AuthorRemoved({ id: 'collaborator' })).model.draft.creatorIds,
    ).toEqual(['collaborator'])
    const changedQuery = update(selected, Message.AuthorQueryChanged({ value: 'Grace' })).model
    expect(
      update(changedQuery, Message.AuthorsFound({ query: 'Ada', creators: [] })).model,
    ).toEqual(changedQuery)
    expect(update(changedQuery, Message.AuthorSearchFailed({ query: 'Ada' })).model).toEqual(
      changedQuery,
    )
  })

  it('keeps source diagnostics tied to the current content, including out-of-order failures', () => {
    const model = initialModel(input)
    const oldContent = '<script>old</script>'
    const content = '<div>current</div>'

    const diagnostics = [
      {
        severity: 'warning' as const,
        code: 'unsupported-html' as const,
        message: 'Raw HTML is not supported.',
        line: 1,
        column: 1,
      },
    ]

    const edited = update(model, Message.Changed({ field: 'content', value: content })).model
    const checked = update(edited, Message.DiagnosticsLoaded({ content, diagnostics })).model
    expect(checked.diagnostics).toEqual(diagnostics)
    expect(
      update(checked, Message.DiagnosticsLoaded({ content: oldContent, diagnostics: [] })).model,
    ).toEqual(checked)
    expect(update(checked, Message.DiagnosticsFailed({ content: oldContent })).model).toEqual(
      checked,
    )
    const renamed = update(checked, Message.Changed({ field: 'title', value: 'A title' })).model
    expect(renamed.diagnostics).toEqual(diagnostics)
    const cleared = update(renamed, Message.Changed({ field: 'content', value: '' })).model
    expect(cleared.diagnostics).toEqual([])
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

    const published = update(
      saved,
      Message.Saved({ id: 'published-id', slug: 'published', published: true }),
    ).model

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

    const resolved = Message.MusicResolved({
      entityType: 'album',
      entityId: 'album-1',
      url,
      title: 'Fixture album',
      artistNames: ['Fixture artist'],
      coverImageUrl: null,
    })

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

  it('resolves saved music after saving or publishing without discarding other edits', () => {
    for (const published of [false, true]) {
      const model = update(
        initialModel(input),
        Message.Saved({ id: 'saved-post', slug: 'saved', published }),
      ).model

      const edited = update(
        model,
        Message.Changed({ field: 'content', value: 'Unsaved notes' }),
      ).model

      const pending = update(edited, Message.ResolvePostMusicRequested()).model
      expect(pending.resolvingPostMusic).toBe(true)
      expect(update(pending, Message.ResolvePostMusicRequested()).model).toBe(pending)

      const resolved = update(
        pending,
        Message.PostMusicResolved({
          postId: 'saved-post',
          entityType: 'track',
          entityId: 'track-1',
          title: 'Music',
          artistNames: [],
          coverImageUrl: null,
          url: 'https://open.spotify.com/track/fixture',
        }),
      ).model

      expect(resolved.resolvingPostMusic).toBe(false)
      expect(resolved.draft).toMatchObject({ content: 'Unsaved notes', musicEntityId: 'track-1' })
      expect(resolved.phase).toBe(model.phase)
    }
  })

  it('enforces the tweet boundary in the model while editorials remain long-form', () => {
    const tweet = {
      ...initialModel(input).draft,
      title: 'x'.repeat(256),
    }

    expect(draftValidationError(tweet)).toBe('Tweets are capped at 255 characters.')
    expect(
      update({ ...initialModel(input), draft: tweet }, Message.PublishRequested()).commands,
    ).toBe(undefined)
    expect(draftValidationError({ ...tweet, kind: 'post' })).toBeNull()
  })

  it('inserts canonical rich-content directives without replacing authored source', () => {
    const model = {
      ...initialModel(input),
      externalMediaUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      draft: {
        ...initialModel(input).draft,
        content: 'Opening paragraph.',
        musicEntityType: 'album' as const,
        musicEntityId: 'album-1',
      },
    }

    const media = update(model, Message.ExternalMediaInserted()).model
    expect(media.draft.content).toBe(
      'Opening paragraph.\n\n::media{url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"}',
    )
    const music = update(media, Message.MusicEmbedInserted()).model
    expect(music.draft.content).toContain('::music{type="album" id="album-1"}')
  })

  it('accepts only the quote response matching the current URL', () => {
    const entered = update(
      initialModel(input),
      Message.QuoteUrlChanged({ value: 'https://goosebumps.fm/tweet/current-thread' }),
    ).model

    const stale = update(
      entered,
      Message.QuoteResolved({ id: 'old-id', slug: 'old-thread', title: 'Old', content: null }),
    ).model

    expect(stale).toBe(entered)

    const resolved = update(
      stale,
      Message.QuoteResolved({
        id: 'current-id',
        slug: 'current-thread',
        title: null,
        content: 'Current tweet',
      }),
    ).model

    expect(resolved.draft.quotedPostId).toBe('current-id')
    expect(resolved.quotePreview).toBe('Current tweet')
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

  it('embeds only links that render as players, and explains rejected links in place', () => {
    const model = { ...initialModel(input), phase: 'writing' as const }

    const page =
      'http://babakushi.bandcamp.com/track/the-vigil-of-mashonisa-feat-b-man-lukorito-ntombela-alberto-ranfery-gusto-new-york-zulu-yuba-ushiii'

    for (const url of [
      'https://bandcamp.com',
      'https://babakushi.bandcamp.com/music',
      'not a url',
    ]) {
      const rejected = update(
        update(model, Message.ExternalMediaChanged({ value: url })).model,
        Message.ExternalMediaInserted(),
      )

      expect(rejected.model.draft.content).toBe('')
      expect(rejected.model.externalMediaError).toContain('Bandcamp track or album')
      expect(rejected.commands).toBeUndefined()
    }

    const typed = update(model, Message.ExternalMediaChanged({ value: page })).model
    const inserted = update(typed, Message.ExternalMediaInserted()).model
    expect(inserted.draft.content).toBe(`::media{url="${page.replace('http:', 'https:')}"}`)
    expect(inserted.externalMediaUrl).toBe('')
    expect(inserted.externalMediaError).toBeNull()
  })

  it('previews the publishing render for the current source and ignores stale responses', () => {
    const model = { ...initialModel(input), phase: 'writing' as const }
    const first = update(model, Message.Changed({ field: 'content', value: 'First' })).model
    const previewing = update(first, Message.EditorModeChanged({ mode: 'preview' }))
    expect(previewing.model.preview).toBe('loading')
    expect(previewing.commands?.map((command) => command.name)).toEqual(['Creator.RenderPreview'])

    const document = { version: 1 as const, blocks: [] }
    const edited = update(previewing.model, Message.MusicEmbedInserted()).model

    const second = update(
      { ...edited, draft: { ...edited.draft, musicEntityType: 'track', musicEntityId: 'track-1' } },
      Message.MusicEmbedInserted(),
    )

    expect(second.model.previewContent).toBe(second.model.draft.content)
    expect(second.commands?.map((command) => command.name)).toContain('Creator.RenderPreview')

    const stale = update(second.model, Message.PreviewLoaded({ content: 'First', document }))
    expect(stale.model.preview).toBe('loading')

    const failed = update(
      second.model,
      Message.PreviewFailed({ content: second.model.draft.content }),
    )

    expect(failed.model.preview).toBe('failed')
    const retried = update(failed.model, Message.PreviewRequested())
    expect(retried.model.preview).toBe('loading')

    const loaded = update(
      retried.model,
      Message.PreviewLoaded({ content: retried.model.draft.content, document }),
    )

    expect(loaded.model).toMatchObject({ preview: 'ready', previewDocument: document })
    expect(
      update(loaded.model, Message.EditorModeChanged({ mode: 'preview' })).commands,
    ).toBeUndefined()
  })
})
