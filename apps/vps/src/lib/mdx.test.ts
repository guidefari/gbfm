import { Effect } from 'effect'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { MdxService, makeMdxServiceTest } from './mdx'

const runWith = <A>(
  compileFn: (content: string) => Promise<string>,
  effect: Effect.Effect<A, unknown, MdxService>
): Promise<A> =>
  Effect.runPromise(Effect.provide(effect, makeMdxServiceTest(compileFn)))

describe('MdxService', () => {
  describe('compile', () => {
    test('returns compiled string on success', async () => {
      const result = await runWith(
        () => Promise.resolve('compiled!'),
        MdxService.pipe(Effect.flatMap((svc) => svc.compile('# Hello')))
      )
      expect(result).toBe('compiled!')
    })

    test('passes content to the compile function', async () => {
      const fn = vi.fn().mockResolvedValue('ok')
      await runWith(
        fn,
        MdxService.pipe(Effect.flatMap((svc) => svc.compile('some content')))
      )
      expect(fn).toHaveBeenCalledWith('some content')
    })

    test('fails with MDXCompileError when compile function throws', async () => {
      const err = new Error('syntax error at line 3')
      await expect(
        runWith(
          () => Promise.reject(err),
          MdxService.pipe(Effect.flatMap((svc) => svc.compile('bad mdx')))
        )
      ).rejects.toMatchObject({
        _tag: 'MDXCompileError',
        details: 'syntax error at line 3'
      })
    })
  })

  describe('caching', () => {
    test('calls compile function once for identical content (cache hit)', async () => {
      const fn = vi.fn().mockResolvedValue('out')
      await runWith(
        fn,
        Effect.gen(function* () {
          const svc = yield* MdxService
          yield* svc.compile('# Hello')
          yield* svc.compile('# Hello')
        })
      )
      expect(fn).toHaveBeenCalledTimes(1)
    })

    test('calls compile function separately for different content (cache miss)', async () => {
      const fn = vi.fn((s: string) => Promise.resolve(`out:${s}`))
      const results = await runWith(
        fn,
        Effect.gen(function* () {
          const svc = yield* MdxService
          const r1 = yield* svc.compile('# A')
          const r2 = yield* svc.compile('# B')
          return [r1, r2]
        })
      )
      expect(fn).toHaveBeenCalledTimes(2)
      expect(results).toEqual(['out:# A', 'out:# B'])
    })

    test('deduplicates concurrent requests for the same content', async () => {
      let calls = 0
      const fn = () =>
        new Promise<string>((resolve) => {
          calls++
          setImmediate(() => resolve('concurrent-result'))
        })

      const result = await runWith(
        fn,
        Effect.gen(function* () {
          const svc = yield* MdxService
          const [r1, r2] = yield* Effect.all(
            [svc.compile('# Same'), svc.compile('# Same')],
            { concurrency: 'unbounded' }
          )
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

      const result = await runWith(
        fn,
        Effect.gen(function* () {
          const svc = yield* MdxService
          // First call fails
          yield* svc.compile('content').pipe(Effect.ignore)
          // Second call should retry (not serve cached failure)
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
      await runWith(
        fn,
        Effect.gen(function* () {
          const svc = yield* MdxService
          yield* svc.compile('# Hello')
          yield* svc.invalidateAll()
          yield* svc.compile('# Hello')
        })
      )
      expect(fn).toHaveBeenCalledTimes(2)
    })

    test('invalidateAll does not affect subsequent different content', async () => {
      const fn = vi.fn((s: string) => Promise.resolve(`out:${s}`))
      await runWith(
        fn,
        Effect.gen(function* () {
          const svc = yield* MdxService
          yield* svc.compile('# A')
          yield* svc.invalidateAll()
          yield* svc.compile('# B')
        })
      )
      expect(fn).toHaveBeenCalledTimes(2)
      expect(fn).toHaveBeenCalledWith('# A')
      expect(fn).toHaveBeenCalledWith('# B')
    })
  })

  describe('test isolation', () => {
    let calls: number

    beforeEach(() => {
      calls = 0
    })

    test('each test layer has its own isolated cache', async () => {
      const fn = () => {
        calls++
        return Promise.resolve('v1')
      }
      // First run — fresh layer
      await runWith(
        fn,
        MdxService.pipe(Effect.flatMap((svc) => svc.compile('same')))
      )
      // Second run — another fresh layer, cache is empty again
      await runWith(
        fn,
        MdxService.pipe(Effect.flatMap((svc) => svc.compile('same')))
      )
      // Each runWith call builds a fresh layer, so fn is called twice
      expect(calls).toBe(2)
    })
  })
})
