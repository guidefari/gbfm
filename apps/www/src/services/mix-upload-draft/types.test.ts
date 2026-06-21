import { describe, expect, test } from 'vitest'
import { parseMixUploadDraft } from './types'

describe('parseMixUploadDraft', () => {
  test('parses a valid draft', () => {
    const draft = parseMixUploadDraft({
      title: 'Mix 1',
      description: 'desc',
      slug: 'mix-1',
      content: '# hello',
      thumbnailUrl: 'https://example.com/x.jpg',
      tags: ['house'],
      tracklist: [{ id: 1, time: 30, title: 'Track 1' }],
      audioFingerprint: 'fp1',
      artworkFingerprint: 'fp2',
      showId: 'show-1',
      episodeNumber: '12',
      creatorId: 'user-1',
      url: 'https://example.com/audio.mp3',
      updatedAt: 1234
    })
    expect(draft).not.toBeNull()
    expect(draft?.title).toBe('Mix 1')
    expect(draft?.tags).toEqual(['house'])
    expect(draft?.tracklist).toEqual([{ id: 1, time: 30, title: 'Track 1' }])
    expect(draft?.audioFingerprint).toBe('fp1')
  })

  test('returns null for malformed input', () => {
    expect(parseMixUploadDraft({ title: 'x' })).toBeNull()
    expect(parseMixUploadDraft('not an object')).toBeNull()
    expect(parseMixUploadDraft(null)).toBeNull()
    expect(parseMixUploadDraft(undefined)).toBeNull()
  })

  test('handles missing optional fields', () => {
    const draft = parseMixUploadDraft({
      title: 'Mix 2',
      description: '',
      slug: '',
      content: '',
      thumbnailUrl: '',
      tags: [],
      tracklist: [],
      updatedAt: 1
    })
    expect(draft).not.toBeNull()
    expect(draft?.audioFingerprint).toBeUndefined()
    expect(draft?.url).toBeUndefined()
  })
})
