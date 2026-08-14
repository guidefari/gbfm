import { Effect } from 'effect'
import { describe, expect, test, vi } from 'vitest'
import { withTestLayer } from '@/test/effect'
import { MdxService, makeMdxServiceTest } from './mdx'

const withService = <A>(
  compileFn: (content: string) => Promise<string>,
  run: (svc: MdxService) => Effect.Effect<A, unknown>
): Promise<A> =>
  Effect.runPromise(
    withTestLayer(
      Effect.gen(function* () {
        const svc = yield* MdxService
        return yield* run(svc)
      }),
      makeMdxServiceTest(compileFn)
    )
  )

describe('MdxService', () => {
  test('fails with MDXCompileError when compile function throws', async () => {
    const err = new Error('syntax error at line 3')
    await expect(
      withService(
        () => Promise.reject(err),
        (svc) => svc.compile('bad mdx')
      )
    ).rejects.toMatchObject({
      _tag: 'MDXCompileError',
      details: 'syntax error at line 3'
    })
  })

  describe('caching', () => {
    test('deduplicates concurrent requests for the same content', async () => {
      let calls = 0
      const fn = () =>
        new Promise<string>((resolve) => {
          calls++
          setImmediate(() => resolve('concurrent-result'))
        })

      const result = await withService(fn, (svc) =>
        Effect.gen(function* () {
          const [r1, r2] = yield* Effect.all([svc.compile('# Same'), svc.compile('# Same')], {
            concurrency: 'unbounded'
          })
          return [r1, r2]
        })
      )
      expect(calls).toBe(1)
      expect(result).toEqual(['concurrent-result', 'concurrent-result'])
    })

    test('does not cache failures — retries on next call', async () => {
      let attempt = 0
      const fn = () => {
        attempt++
        if (attempt === 1) return Promise.reject(new Error('transient'))
        return Promise.resolve('recovered')
      }

      const result = await withService(fn, (svc) =>
        Effect.gen(function* () {
          yield* svc.compile('content').pipe(Effect.ignore)
          return yield* svc.compile('content')
        })
      )
      expect(attempt).toBe(2)
      expect(result).toBe('recovered')
    })
  })

  describe('invalidateAll', () => {
    test('forces recompilation after cache is cleared', async () => {
      const fn = vi.fn().mockResolvedValue('fresh')
      await withService(fn, (svc) =>
        Effect.gen(function* () {
          yield* svc.compile('# Hello')
          yield* svc.invalidateAll
          yield* svc.compile('# Hello')
        })
      )
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })
})
