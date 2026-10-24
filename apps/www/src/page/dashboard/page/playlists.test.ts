import type { PlaylistResponse } from '@gbfm/api/music'
import { describe, expect, it } from 'vitest'

import * as Dashboard from '..'
import { initialModel, Message, update } from './playlists'

const playlist: PlaylistResponse = {
  id: 'second',
  title: 'Second playlist',
  slug: 'second-playlist',
  description: null,
  coverImageUrl: null,
  curatorId: null,
  publishedAt: null,
  createdById: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('playlist editing', () => {
  it('does not save the previous playlist form after selecting a playlist whose tracks fail to load', () => {
    const previous = {
      ...initialModel,
      selected: 'first',
      listing: [playlist],
      form: { ...initialModel.form, title: 'Unsaved first playlist', slug: 'first' },
    }

    const selected = update(previous, Message.Select({ id: playlist.id }))
    expect(update(selected.model, Message.New()).model).toBe(selected.model)
    const failed = update(selected.model, Message.Failed({ message: 'Tracks unavailable' }))
    expect(failed.model.form).toMatchObject({ title: 'Second playlist', slug: 'second-playlist' })
    expect(failed.model.selected).toBe('second')
    expect(failed.model.tracks).toEqual([])
    const saving = update(failed.model, Message.Save())
    expect(saving.commands?.[0]?.args).toMatchObject({
      selected: 'second',
      form: { title: 'Second playlist' },
    })
  })

  it('requires confirmation for deletion and admin access for playlist commands', () => {
    const model = { ...initialModel, selected: playlist.id }
    expect(update(model, Message.ConfirmDelete()).commands).toBeUndefined()
    const asking = update(model, Message.AskDelete())
    expect(update(asking.model, Message.ConfirmDelete()).commands).toHaveLength(1)
    const canceled = update(asking.model, Message.CancelDelete())
    expect(update(canceled.model, Message.ConfirmDelete()).commands).toBeUndefined()
    const member = Dashboard.initialModel('playlists', { id: 'member', role: 'user' })
    expect(
      Dashboard.update(member, Dashboard.Message.GotPlaylistMessage({ message: Message.Import() }))
        .commands,
    ).toBeUndefined()
  })

  it('opens a new playlist form on demand and returns to the list', () => {
    const creating = update({ ...initialModel, listing: [playlist] }, Message.New()).model
    expect(creating).toMatchObject({ creating: true, selected: null, listing: [playlist] })
    expect(update(creating, Message.Back()).model).toMatchObject({ creating: false })

    const saved = update(
      creating,
      Message.Saved({ selected: null, notice: 'Playlist changes saved.', resetForm: true }),
    ).model

    expect(saved.creating).toBe(false)
  })
})
