import { describe, expect, test } from 'vitest'
import {
  buildSocialCardPresentation,
  buildTweetCardPresentation,
  SOCIAL_CARD_DIMENSIONS,
  TWEET_CARD_FORMATS
} from './index'

const artworkInput = {
  kind: 'mix' as const,
  slug: 'forest-drive-west-at-gbfm',
  title: 'Forest Drive West at goosebumps.fm',
  creators: ['Forest Drive West'],
  imageUrl: 'https://cdn.goosebumps.fm/mix.png'
}

describe('social card presentation', () => {
  test('builds one immutable Open Graph image for artwork-led content', async () => {
    const presentation = await buildSocialCardPresentation(artworkInput)

    expect(presentation).toMatchObject({
      schemaVersion: 1,
      model: {
        _tag: 'ArtworkCard',
        kind: 'mix',
        title: artworkInput.title,
        creators: artworkInput.creators,
        artworkUrl: artworkInput.imageUrl
      }
    })
    expect(presentation.revision).toMatch(/^[a-f0-9]{16}$/)
    expect(presentation.images).toEqual({
      openGraph: `https://goosebumps.fm/social/cards/mix/${artworkInput.slug}/${presentation.revision}/open-graph.png`
    })
    expect(SOCIAL_CARD_DIMENSIONS.openGraph).toEqual([1200, 630])
  })

  test('changes only the affected presentation revision', async () => {
    const original = await buildSocialCardPresentation(artworkInput)
    const edited = await buildSocialCardPresentation({
      ...artworkInput,
      title: 'Forest Drive West — live'
    })

    expect(edited.revision).not.toBe(original.revision)
  })

  test('selects identity and editorial layouts from their content kinds', async () => {
    const show = await buildSocialCardPresentation({
      kind: 'show',
      slug: 'far-end-radio',
      title: 'Far End Radio',
      description: 'An open-ended monthly radio residency.',
      detail: 'Hosted by Guide Fari',
      imageUrl: null
    })
    const editorial = await buildSocialCardPresentation({
      kind: 'editorial',
      slug: 'active-passive',
      title: 'Active / Passive',
      description: 'Notes on listening with intent.',
      authors: ['Guide Fari'],
      imageUrl: null,
      publishedAt: '2026-09-18T23:30:00.000-08:00'
    })

    expect(show.model).toMatchObject({
      _tag: 'IdentityCard',
      kind: 'show',
      eyebrow: 'Radio show',
      detail: 'Hosted by Guide Fari'
    })
    expect(editorial.model).toMatchObject({
      _tag: 'EditorialCard',
      kind: 'editorial',
      authors: ['Guide Fari'],
      publishedLabel: 'Sep 19, 2026'
    })
  })

  test('preserves the three tweet export formats on the shared route family', async () => {
    const presentation = await buildTweetCardPresentation({
      slug: 'vusa-just-resurfaced',
      commentary: 'Vusa just resurfaced this. Pairs well with the lounge.',
      createdAt: '2026-09-12T23:30:00.000-08:00',
      creator: {
        name: 'Guide Fari',
        username: 'guidefari',
        avatarUrl: 'https://cdn.goosebumps.fm/user-content/avatar.png'
      },
      entity: {
        type: 'album',
        title: 'A Long Way From Home',
        artists: ['Vusa Mkhaya', 'M3NSA'],
        coverImageUrl: 'https://cdn.goosebumps.fm/user-content/cover.png'
      }
    })

    expect(presentation.model.kind).toBe('tweet')
    expect(presentation.model._tag).toBe('TweetCard')
    expect(presentation.model.entityLabel).toBe('Album')
    expect(Object.keys(presentation.images)).toEqual(TWEET_CARD_FORMATS)
    expect(presentation.images.openGraph).toContain('/social/cards/tweet/vusa-just-resurfaced/')
  })
})
