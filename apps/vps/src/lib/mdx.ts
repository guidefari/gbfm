import { compile } from '@mdx-js/mdx'
import { Cache, Context, Data, Duration, Effect, Exit, Layer } from 'effect'

// ── Error ─────────────────────────────────────────────────────────────────────

export class MDXCompileError extends Data.TaggedError('MDXCompileError')<{
  readonly message: string
  readonly details?: string
}> {}

// ── Service ───────────────────────────────────────────────────────────────────

export interface MdxService {
  readonly compile: (content: string) => Effect.Effect<string, MDXCompileError>
  readonly invalidateAll: () => Effect.Effect<void>
}

export const MdxService = Context.Service<MdxService>('MdxService')

// ── Internal helpers ──────────────────────────────────────────────────────────

const makeLookup =
  (fn: (content: string) => Promise<string>) =>
  (content: string): Effect.Effect<string, MDXCompileError> =>
    Effect.tryPromise({
      try: () => fn(content),
      catch: (error) =>
        new MDXCompileError({
          message: 'Failed to compile MDX content',
          details: error instanceof Error ? error.message : String(error)
        })
    })

const ttl = (exit: Exit.Exit<string, MDXCompileError>) =>
  Exit.isSuccess(exit) ? Duration.hours(1) : Duration.zero

const defaultFn = (content: string): Promise<string> =>
  compile(content, { outputFormat: 'function-body' }).then((r) => r.toString())

const makeService = (fn: (content: string) => Promise<string>): Effect.Effect<MdxService> =>
  Effect.gen(function* () {
    const cache = yield* Cache.makeWith(makeLookup(fn), {
      capacity: 256,
      timeToLive: ttl
    })
    return MdxService.of({
      compile: (content) => Cache.get(cache, content),
      invalidateAll: () => Cache.invalidateAll(cache)
    })
  })

// ── Live layer ────────────────────────────────────────────────────────────────

export const MdxServiceLive: Layer.Layer<MdxService> = Layer.effect(
  MdxService,
  makeService(defaultFn)
)

// ── Test factory ──────────────────────────────────────────────────────────────

export const makeMdxServiceTest = (
  fn: (content: string) => Promise<string>
): Layer.Layer<MdxService> => Layer.effect(MdxService, makeService(fn))

// ── Backward-compat shim (for show, label, release, resolve services) ─────────

export interface MDXCompilationResult {
  compiled: string
}

export interface MDXError {
  error: string
  details?: string
}

export function isMDXCompilationResult(
  result: MDXCompilationResult | MDXError
): result is MDXCompilationResult {
  return !('error' in result)
}

// Module-level cache shared by services that haven't migrated to MdxService
const shimCache: Cache.Cache<string, string, MDXCompileError> = Effect.runSync(
  Cache.makeWith(makeLookup(defaultFn), { capacity: 256, timeToLive: ttl })
)

export async function compileMDX(mdxContent: string): Promise<MDXCompilationResult | MDXError> {
  return Effect.runPromise(
    Cache.get(shimCache, mdxContent).pipe(
      Effect.map((compiled) => ({ compiled }) as MDXCompilationResult),
      Effect.catchTag('MDXCompileError', (e) =>
        Effect.succeed<MDXError>({ error: e.message, details: e.details })
      )
    )
  )
}
