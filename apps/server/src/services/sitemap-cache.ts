import { Context, Effect, Layer, Option } from 'effect'
import { SitemapCacheError } from '@/errors'

export interface SitemapXml {
  readonly xml: string
  readonly generatedAt: Date
}

export interface SitemapCacheShape {
  readonly read: () => Effect.Effect<Option.Option<SitemapXml>, never>
  readonly write: (xml: SitemapXml) => Effect.Effect<void, SitemapCacheError>
}

export class SitemapCache extends Context.Service<SitemapCache, SitemapCacheShape>()(
  'SitemapCache'
) {}

const SITEMAP_KEY = 'sitemap.xml'

interface StoredSitemap {
  readonly xml: string
  readonly generatedAt: string
}

export interface SitemapKv {
  get(key: string, type: 'json'): Promise<StoredSitemap | null>
  put(key: string, value: string): Promise<void>
}

export const SitemapCacheLayer = (kv: SitemapKv) =>
  Layer.succeed(SitemapCache, {
    read: () =>
      Effect.tryPromise(() => kv.get(SITEMAP_KEY, 'json')).pipe(
        Effect.map((stored) =>
          stored
            ? Option.some({ xml: stored.xml, generatedAt: new Date(stored.generatedAt) })
            : Option.none()
        ),
        Effect.catch(() => Effect.succeed(Option.none<SitemapXml>()))
      ),
    write: (sitemap) =>
      Effect.tryPromise({
        try: () =>
          kv.put(
            SITEMAP_KEY,
            JSON.stringify({ xml: sitemap.xml, generatedAt: sitemap.generatedAt.toISOString() })
          ),
        catch: (error) =>
          new SitemapCacheError({
            message: `Failed to write sitemap cache: ${error instanceof Error ? error.message : String(error)}`
          })
      })
  })
