import { describe, expect, test } from 'vitest'
import { buildTweetCardPresentation, TWEET_CARD_FORMATS } from './index'

const input = {
  slug: 'vusa-just-resurfaced',
  commentary: 'Vusa just resurfaced this. Pairs well with the lounge.',
  createdAt: '2026-09-12T23:30:00.000-08:00',
  creator: {
    name: 'Guide Fari',
    username: 'guidefari',
    avatarUrl: 'https://cdn.goosebumps.fm/user-content/avatar.png'
  },
  entity: {
    type: 'album' as const,
    title: 'A Long Way From Home',
    artists: ['Vusa Mkhaya', 'M3NSA'],
    coverImageUrl: 'https://cdn.goosebumps.fm/user-content/cover.png'
  }
}

describe('tweet card presentation', () => {
  test('builds one revisioned image family from normalized tweet data', async () => {
    const presentation = await buildTweetCardPresentation(input)

    expect(presentation.model).toEqual({
      commentary: input.commentary,
      authorName: 'Guide Fari',
      username: 'guidefari',
      avatarUrl: input.creator.avatarUrl,
      dateLabel: 'Sep 13, 2026',
      entityLabel: 'ALBUM',
      entityTitle: 'A Long Way From Home',
      entityArtists: 'Vusa Mkhaya, M3NSA',
      coverImageUrl: input.entity.coverImageUrl,
      url: 'https://goosebumps.fm/tweet/vusa-just-resurfaced'
    })
    expect(presentation.revision).toMatch(/^[a-f0-9]{16}$/)
    expect(Object.keys(presentation.images)).toEqual(TWEET_CARD_FORMATS)
    expect(presentation.images.openGraph).toBe(
      `https://goosebumps.fm/social/tweets/vusa-just-resurfaced/${presentation.revision}/open-graph.png`
    )
  })

  test('changes revision when any rendered dependency changes', async () => {
    const original = await buildTweetCardPresentation(input)
    const editedTweet = await buildTweetCardPresentation({ ...input, commentary: 'Edited copy' })
    const editedArtwork = await buildTweetCardPresentation({
      ...input,
      entity: { ...input.entity, coverImageUrl: 'https://cdn.goosebumps.fm/new-cover.png' }
    })

    expect(editedTweet.revision).not.toBe(original.revision)
    expect(editedArtwork.revision).not.toBe(original.revision)
  })
})
