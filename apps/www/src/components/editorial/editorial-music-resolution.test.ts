import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { resolveMusicEntityBatchEffect } from './editorial-music-resolution'

describe('resolveMusicEntityBatchEffect', () => {
  test('deduplicates work while preserving first-seen order', async () => {
    const resolvedUrls: string[] = []
    const resolve = (url: string) =>
      Effect.sync(() => {
        resolvedUrls.push(url)
        return { type: 'album' as const, id: `entity-${url}` }
      })

    const results = await Effect.runPromise(
      resolveMusicEntityBatchEffect(['first', 'second', 'first'], resolve)
    )

    expect(resolvedUrls).toEqual(['first', 'second'])
    expect(results.map((result) => result.url)).toEqual(['first', 'second'])
  })

  test('keeps successful resolutions when another scrape fails', async () => {
    const resolve = (url: string) =>
      url === 'broken'
        ? Effect.fail({ _tag: 'ScrapeFailed' as const })
        : Effect.succeed({ type: 'album' as const, id: `entity-${url}` })

    const results = await Effect.runPromise(
      resolveMusicEntityBatchEffect(['first', 'broken', 'second'], resolve)
    )

    expect(results).toEqual([
      {
        status: 'resolved',
        url: 'first',
        reference: { type: 'album', id: 'entity-first' }
      },
      { status: 'failed', url: 'broken' },
      {
        status: 'resolved',
        url: 'second',
        reference: { type: 'album', id: 'entity-second' }
      }
    ])
  })

  test('runs up to three resolutions concurrently', async () => {
    let active = 0
    let maximumActive = 0
    const resolve = (url: string) =>
      Effect.tryPromise({
        try: () =>
          new Promise<{ readonly type: 'album'; readonly id: string }>((complete) => {
            active += 1
            maximumActive = Math.max(maximumActive, active)
            setTimeout(() => {
              active -= 1
              complete({ type: 'album', id: `entity-${url}` })
            }, 5)
          }),
        catch: () => ({ _tag: 'UnexpectedResolutionFailure' as const })
      })

    await Effect.runPromise(
      resolveMusicEntityBatchEffect(['one', 'two', 'three', 'four', 'five'], resolve)
    )

    expect(maximumActive).toBe(3)
  })
})
