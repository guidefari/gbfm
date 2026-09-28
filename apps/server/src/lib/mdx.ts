/* oxlint-disable anti-slop-effect/no-manual-tagged-construction, anti-slop-effect/no-manual-tag-comparison -- Rich-content nodes are Schema-owned recursive unions without generated constructors or matchers. */
import type { RichContentBlock, RichContentDocument, SafeUrl } from '@gbfm/rich-content/schema'
import {
  parseRichContent,
  type UnresolvedBlock,
  type UnresolvedDocument,
} from '@gbfm/rich-content/source'
import { Cache, Context, Data, Duration, Effect, Exit, Layer } from 'effect'

import { ValidationError } from '@/errors'

// ── Error ─────────────────────────────────────────────────────────────────────

export class MDXCompileError extends Data.TaggedError('MDXCompileError')<{
  readonly message: string
  readonly details?: string
}> {}

// ── Service ───────────────────────────────────────────────────────────────────

export interface MdxService {
  readonly compile: (content: string) => Effect.Effect<string, MDXCompileError>
  readonly render: (content: string) => Effect.Effect<RichContentDocument>
  readonly invalidateAll: Effect.Effect<void>
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
          details: error instanceof Error ? error.message : String(error),
        }),
    })

const ttl = (exit: Exit.Exit<string, MDXCompileError>) =>
  Exit.isSuccess(exit) ? Duration.hours(1) : Duration.zero

const defaultFn = (_content: string): Promise<string> => Promise.resolve('')

const makeService = (fn: (content: string) => Promise<string>): Effect.Effect<MdxService> =>
  Effect.gen(function* () {
    const compiledCache = yield* Cache.makeWith(makeLookup(fn), {
      capacity: 256,
      timeToLive: ttl,
    })

    const renderCache = yield* Cache.makeWith(
      (content: string) => Effect.sync(() => renderRichContent(content)),
      {
        capacity: 256,
        timeToLive: () => Duration.hours(1),
      },
    )

    return MdxService.of({
      compile: (content) =>
        Cache.get(compiledCache, content).pipe(
          Effect.withSpan('mdx.compile', {
            attributes: { 'mdx.contentLength': content.length },
          }),
        ),
      render: (content) => Cache.get(renderCache, content),
      invalidateAll: Cache.invalidateAll(compiledCache).pipe(
        Effect.andThen(Cache.invalidateAll(renderCache)),
      ),
    })
  })

// ── Live layer ────────────────────────────────────────────────────────────────

export const MdxServiceLayer: Layer.Layer<MdxService> = Layer.effect(
  MdxService,
  makeService(defaultFn),
)

// ── Test factory ──────────────────────────────────────────────────────────────

export const makeMdxServiceTest = (
  fn: (content: string) => Promise<string>,
): Layer.Layer<MdxService> => Layer.effect(MdxService, makeService(fn))

// ── Backward-compat shim (for show, label, release, resolve services) ─────────

export interface MDXCompilationResult {
  compiled: string
  richContent: RichContentDocument
}

export interface MDXError {
  error: string
  details?: string | undefined
}

export function isMDXCompilationResult(
  result: MDXCompilationResult | MDXError,
): result is MDXCompilationResult {
  return !('error' in result)
}

// Module-level cache shared by services that haven't migrated to MdxService
const shimCache: Cache.Cache<string, string, MDXCompileError> = Effect.runSync(
  Cache.makeWith(makeLookup(defaultFn), { capacity: 256, timeToLive: ttl }),
)

export async function compileMDX(mdxContent: string): Promise<MDXCompilationResult | MDXError> {
  return Effect.runPromise(
    Cache.get(shimCache, mdxContent).pipe(
      Effect.map(
        (compiled): MDXCompilationResult => ({
          compiled,
          richContent: renderRichContent(mdxContent),
        }),
      ),
      Effect.catchTag('MDXCompileError', (e) =>
        Effect.succeed<MDXError>({ error: e.message, details: e.details }),
      ),
    ),
  )
}

const unavailable = (
  kind: Extract<RichContentBlock, { _tag: 'UnavailableEmbed' }>['kind'],
  label: string,
  href: SafeUrl | null,
): RichContentBlock => ({ _tag: 'UnavailableEmbed', kind, label, href })

const externalMedia = (
  url: SafeUrl,
): Extract<RichContentBlock, { _tag: 'ExternalMediaEmbed' }> | null => {
  const parsed = new URL(url)
  const host = parsed.hostname.toLowerCase()
  const parts = parsed.pathname.split('/').filter(Boolean)

  if (host === 'youtu.be' || host === 'youtube.com' || host === 'www.youtube.com') {
    const videoId = host === 'youtu.be' ? parts[0] : (parsed.searchParams.get('v') ?? parts[1])

    if (!videoId) return null

    return {
      _tag: 'ExternalMediaEmbed',
      provider: 'youtube',
      canonicalUrl: url,
      embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`,
      title: 'YouTube video',
      aspectRatio: 16 / 9,
    }
  }

  if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com'))
    return {
      _tag: 'ExternalMediaEmbed',
      provider: 'soundcloud',
      canonicalUrl: url,
      embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`,
      title: 'SoundCloud player',
      aspectRatio: 16 / 5,
    }

  if (host === 'open.spotify.com' && parts.length === 2)
    return {
      _tag: 'ExternalMediaEmbed',
      provider: 'spotify',
      canonicalUrl: url,
      embedUrl: `https://open.spotify.com/embed/${parts[0]}/${encodeURIComponent(parts[1] ?? '')}`,
      title: 'Spotify player',
      aspectRatio: 16 / 9,
    }

  return null
}

const resolveBlock = (block: UnresolvedBlock): RichContentBlock => {
  if (block._tag === 'EmbedReference') {
    if (block.reference._tag === 'ExternalMedia') {
      return (
        externalMedia(block.reference.url) ??
        unavailable('media', 'This media embed is unavailable.', block.reference.url)
      )
    }

    if (block.reference._tag === 'MusicUrl') {
      return (
        externalMedia(block.reference.url) ??
        unavailable('music', 'This music embed is unavailable.', block.reference.url)
      )
    }

    return unavailable('music', 'This catalog music embed is unavailable.', null)
  }

  if (block._tag === 'Quote' || block._tag === 'CardGroup')
    return { ...block, children: block.children.map(resolveBlock) }

  if (block._tag === 'List')
    return {
      ...block,
      items: block.items.map((item) => ({ ...item, children: item.children.map(resolveBlock) })),
    }

  return block
}

const resolveDocument = (document: UnresolvedDocument): RichContentDocument => ({
  version: 1,
  blocks: document.blocks.map(resolveBlock),
})

export const renderRichContent = (source: string): RichContentDocument =>
  resolveDocument(parseRichContent(source).document)

export const validateCanonicalContent = (
  source: string | null | undefined,
): Effect.Effect<void, ValidationError> => {
  if (!source) return Effect.void
  const diagnostics = parseRichContent(source).diagnostics

  return diagnostics.length === 0
    ? Effect.void
    : Effect.fail(
        new ValidationError({
          message: diagnostics.map((item) => item.message).join('; '),
        }),
      )
}
