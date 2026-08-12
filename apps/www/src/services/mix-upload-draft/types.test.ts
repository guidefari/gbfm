import { describe, expect, test } from 'vitest'
import { parseMixUploadDraft } from './types'

describe('parseMixUploadDraft', () => {
  test('restores complete and minimally populated mix-upload drafts', () => {
    const complete = {
      title: 'Mix 1',
      description: 'desc',
      slug: 'mix-1',
      content: '# hello',
      thumbnailUrl: 'https://example.com/x.jpg',
      tags: ['house'],
      tracklist: [{ id: 1, time: 30, title: 'Track 1' }],
      audioFingerprint: 'fp1',
      audioFileName: 'mix.mp3',
      artworkFingerprint: 'fp2',
      artworkFileName: 'cover.jpg',
      showId: 'show-1',
      episodeNumber: '12',
      creatorId: 'user-1',
      url: 'https://example.com/audio.mp3',
      updatedAt: 1234
    }
    const minimal = {
      title: 'Mix 2',
      description: '',
      slug: '',
      content: '',
      thumbnailUrl: '',
      tags: [],
      tracklist: [],
      updatedAt: 1
    }

    expect(parseMixUploadDraft(complete)).toEqual(complete)
    expect(parseMixUploadDraft(minimal)).toEqual({
      ...minimal,
      audioFingerprint: undefined,
      audioFileName: undefined,
      artworkFingerprint: undefined,
      artworkFileName: undefined,
      showId: undefined,
      episodeNumber: undefined,
      creatorId: undefined,
      url: undefined
    })
  })

  test('returns null instead of restoring malformed draft data', () => {
    expect(parseMixUploadDraft({ title: 'x' })).toBeNull()
    expect(parseMixUploadDraft('not an object')).toBeNull()
    expect(parseMixUploadDraft(null)).toBeNull()
    expect(
      parseMixUploadDraft({
        title: 'Mix 2',
        description: '',
        slug: '',
        content: '',
        thumbnailUrl: '',
        tags: ['house'],
        tracklist: [{ id: 'wrong', time: 30, title: 'Track' }],
        updatedAt: 1
      })
    ).toBeNull()
  })
})
