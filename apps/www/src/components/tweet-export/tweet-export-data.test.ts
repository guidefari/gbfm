import { describe, expect, it } from 'vitest'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { SITE_URL } from '@/lib/seo'
import { buildTweetExportData } from './tweet-export-data'

const post = {
  title: 'this record is unreal',
  createdAt: '2026-03-14T00:00:00.000Z',
  musicEntityType: 'album',
  musicEntityId: 'abc',
  creators: [{ name: 'Guide', username: 'guide' }]
}

describe('buildTweetExportData', () => {
  it('maps a post and its resolved entity onto the export frame data', () => {
    const data = buildTweetExportData({
      post,
      slug: 'unreal',
      avatarUrl: 'https://cdn.goosebumps.fm/guide.jpg',
      entityType: 'album',
      entity: {
        id: 'abc',
        title: 'Unreal',
        slug: 'unreal',
        coverImageUrl: 'https://cdn.goosebumps.fm/cover.jpg',
        artistNames: ['Artist One', 'Artist Two']
      }
    })

    expect(data).toStrictEqual({
      commentary: 'this record is unreal',
      authorName: 'Guide',
      username: 'guide',
      avatarUrl: 'https://cdn.goosebumps.fm/guide.jpg',
      dateLabel: 'Mar 14, 2026',
      entityLabel: 'album',
      entityTitle: 'Unreal',
      entityArtists: 'Artist One, Artist Two',
      coverImageUrl: 'https://cdn.goosebumps.fm/cover.jpg',
      url: `${SITE_URL}/tweet/unreal`
    })
  })

  it('falls back to the default avatar and nulls the entity fields when nothing resolved', () => {
    const data = buildTweetExportData({
      post: { ...post, createdAt: null, creators: [] },
      slug: 'unreal',
      avatarUrl: null,
      entityType: null,
      entity: null
    })

    expect(data.avatarUrl).toBe(DEFAULT_IMAGE_URL)
    expect(data.dateLabel).toBeNull()
    expect(data.authorName).toBeNull()
    expect(data.entityLabel).toBeNull()
    expect(data.entityTitle).toBeNull()
    expect(data.entityArtists).toBeNull()
  })
})
