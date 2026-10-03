/* oxlint-disable anti-slop-effect/no-manual-tagged-construction, anti-slop-effect/no-manual-tag-comparison -- Rich-content nodes are Schema-owned recursive unions without generated constructors or matchers. */
import type { RichContentBlock, RichContentDocument, SafeUrl } from '@gbfm/rich-content/schema'
import {
  parseRichContent,
  type EmbedReference,
  type UnresolvedBlock,
  type UnresolvedDocument,
} from '@gbfm/rich-content/source'
import { Cache, Context, Data, Duration, Effect, Exit, Layer } from 'effect'

import { ValidationError } from '@/errors'
import {
  RichContentMusicResolver,
  type RichContentMusicResolver as RichContentMusicResolverService,
} from '@/services/rich-content-music.service'

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

const unavailableMusicResolver: RichContentMusicResolverService = {
  resolve: () => Effect.succeed(null),
}

const makeService = (
  fn: (content: string) => Promise<string>,
  musicResolver: RichContentMusicResolverService,
): Effect.Effect<MdxService> =>
  Effect.gen(function* () {
    const compiledCache = yield* Cache.makeWith(makeLookup(fn), {
      capacity: 256,
      timeToLive: ttl,
    })

    const renderCache = yield* Cache.makeWith(
      (content: string) => resolveDocument(parseRichContent(content).document, musicResolver),
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

export const MdxService = Context.Service<MdxService>('MdxService')

// ── Live layer ────────────────────────────────────────────────────────────────

export const MdxServiceLayer: Layer.Layer<MdxService> = Layer.effect(
  MdxService,
  makeService(defaultFn, unavailableMusicResolver),
)

export const MdxServiceCatalogLayer: Layer.Layer<MdxService, never, RichContentMusicResolver> =
  Layer.effect(
    MdxService,
    Effect.gen(function* () {
      const musicResolver = yield* RichContentMusicResolver

      return yield* makeService(defaultFn, musicResolver)
    }),
  )

// ── Test factory ──────────────────────────────────────────────────────────────

export const makeMdxServiceTest = (
  fn: (content: string) => Promise<string>,
): Layer.Layer<MdxService> => Layer.effect(MdxService, makeService(fn, unavailableMusicResolver))

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

  if (
    host === 'youtu.be' ||
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'www.youtube-nocookie.com'
  ) {
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

  if (host === 'bandcamp.com' && parts[0] === 'EmbeddedPlayer')
    return {
      _tag: 'ExternalMediaEmbed',
      provider: 'bandcamp',
      canonicalUrl: url,
      embedUrl: url,
      title: 'Bandcamp player',
      aspectRatio: 16 / 5,
    }

  return null
}

type MusicReference = Extract<EmbedReference, { readonly _tag: 'MusicUrl' | 'MusicCatalog' }>

const musicEmbed = (
  reference: MusicReference,
  music: Extract<RichContentBlock, { readonly _tag: 'MusicEmbed' }>['music'] | null,
): RichContentBlock => {
  if (music === null)
    return unavailable(
      'music',
      'This music embed is unavailable.',
      reference._tag === 'MusicUrl' ? reference.url : null,
    )

  return {
    _tag: 'MusicEmbed',
    music,
    genres: reference._tag === 'MusicUrl' ? reference.genres : [],
    blurb: reference._tag === 'MusicUrl' ? reference.blurb : null,
    showTracks: reference.showTracks,
  }
}

const resolveBlock = (
  block: UnresolvedBlock,
  musicResolver: RichContentMusicResolverService,
): Effect.Effect<RichContentBlock> => {
  if (block._tag === 'EmbedReference') {
    if (block.reference._tag === 'ExternalMedia') {
      return Effect.succeed(
        externalMedia(block.reference.url) ??
          unavailable('media', 'This media embed is unavailable.', block.reference.url),
      )
    }

    const reference = block.reference

    return musicResolver
      .resolve(reference)
      .pipe(Effect.map((music) => musicEmbed(reference, music)))
  }

  if (block._tag === 'Quote' || block._tag === 'CardGroup')
    return Effect.all(
      block.children.map((child) => resolveBlock(child, musicResolver)),
      { concurrency: 8 },
    ).pipe(Effect.map((children) => ({ ...block, children })))

  if (block._tag === 'List')
    return Effect.all(
      block.items.map((item) =>
        Effect.all(
          item.children.map((child) => resolveBlock(child, musicResolver)),
          { concurrency: 8 },
        ).pipe(Effect.map((children) => ({ ...item, children }))),
      ),
      { concurrency: 8 },
    ).pipe(Effect.map((items) => ({ ...block, items })))

  return Effect.succeed(block)
}

const resolveDocument = (
  document: UnresolvedDocument,
  musicResolver: RichContentMusicResolverService,
): Effect.Effect<RichContentDocument> =>
  Effect.all(
    document.blocks.map((block) => resolveBlock(block, musicResolver)),
    { concurrency: 8 },
  ).pipe(Effect.map((blocks) => ({ version: 1 as const, blocks })))

export const renderRichContent = (source: string): RichContentDocument =>
  Effect.runSync(resolveDocument(parseRichContent(source).document, unavailableMusicResolver))

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
