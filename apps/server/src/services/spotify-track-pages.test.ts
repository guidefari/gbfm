import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { collectSpotifyTrackPages } from './spotify-track-pages'

describe('collectSpotifyTrackPages', () => {
  test('reuses the embedded page and collects subsequent album pages in order', async () => {
    const initialPage = { items: ['first', 'second'], offset: 0, limit: 2, next: 'page-2' }
    const requests: Array<{ offset: number; limit: number }> = []
    const result = await Effect.runPromise(
      collectSpotifyTrackPages(initialPage, (options) =>
        Effect.sync(() => {
          requests.push(options)
          return options.offset === 2
            ? { items: ['third', 'fourth'], offset: 2, limit: 2, next: 'page-3' }
            : { items: ['fifth'], offset: 4, limit: 2, next: null }
        })
      )
    )

    expect(result).toEqual(['first', 'second', 'third', 'fourth', 'fifth'])
    expect(requests).toEqual([
      { offset: 2, limit: 50 },
      { offset: 4, limit: 50 }
    ])
    expect(initialPage.items).toEqual(['first', 'second'])
  })

  test('keeps repeated playlist tracks and unavailable items before caller filtering', async () => {
    type Item = { track: { id: string } | null }
    const repeatedTrack: Item = { track: { id: 'repeated' } }
    const unavailable: Item = { track: null }
    const finalTrack: Item = { track: { id: 'last' } }
    const requests: number[] = []
    const result = await Effect.runPromise(
      collectSpotifyTrackPages(
        { items: [repeatedTrack, unavailable], offset: 0, limit: 2, next: 'page-2' },
        ({ offset }) =>
          Effect.sync(() => {
            requests.push(offset)
            return offset === 2
              ? { items: [unavailable, repeatedTrack], offset: 2, limit: 2, next: 'page-3' }
              : { items: [finalTrack], offset: 4, limit: 2, next: null }
          })
      )
    )

    expect(result).toEqual([repeatedTrack, unavailable, unavailable, repeatedTrack, finalTrack])
    expect(result.flatMap((item) => (item.track ? [item.track.id] : []))).toEqual([
      'repeated',
      'repeated',
      'last'
    ])
    expect(requests).toEqual([2, 4])
  })

  test.each([{ items: [] }, { items: ['only track'] }])(
    'does not load another page for a complete page: $items',
    async ({ items }) => {
      const requests: number[] = []
      const result = await Effect.runPromise(
        collectSpotifyTrackPages({ items, offset: 0, limit: 50, next: null }, ({ offset }) => {
          requests.push(offset)
          return Effect.fail('Unexpected page request')
        })
      )

      expect(result).toEqual(items)
      expect(requests).toEqual([])
    }
  )

  test('propagates a later page failure without returning a partial list', async () => {
    const failure = { reason: 'rate limited', retryAfterSeconds: 10 }
    const requests: number[] = []
    const result = await Effect.runPromise(
      collectSpotifyTrackPages(
        { items: ['first'], offset: 0, limit: 1, next: 'page-2' },
        ({ offset }) => {
          requests.push(offset)
          return offset === 1
            ? Effect.succeed({ items: ['second'], offset: 1, limit: 1, next: 'page-3' })
            : Effect.fail(failure)
        }
      ).pipe(Effect.flip)
    )

    expect(result).toBe(failure)
    expect(requests).toEqual([1, 2])
  })
})
