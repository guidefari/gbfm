import { Effect } from 'effect'
import type { Context } from 'hono'
import { runApp } from '@/runtime'
import { config } from '@/services/config.service'
import { buildSitemapIndexXml, getCachedSitemap } from './sitemap.service'

const EMPTY_SITEMAP =
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'

export const sitemapXml = async (c: Context) => {
  const result = await runApp(getCachedSitemap.pipe(Effect.either))

  c.header('Content-Type', 'application/xml; charset=utf-8')

  if (result._tag === 'Left') {
    Effect.logError('[Sitemap] Error getting sitemap', {
      error:
        result.left instanceof Error
          ? result.left.message
          : String(result.left)
    }).pipe(Effect.runPromise)

    return c.text(EMPTY_SITEMAP, 500)
  }

  const { xml, generatedAt } = result.right

  // Cache for 1 hour, but allow stale content for 24 hours while revalidating
  c.header(
    'Cache-Control',
    'public, max-age=3600, stale-while-revalidate=86400'
  )
  c.header('Last-Modified', generatedAt.toUTCString())

  return c.text(xml)
}

export const sitemapIndexXml = async (c: Context) => {
  const siteUrl = config.urls.frontend.replace(/\/$/, '')
  const xml = buildSitemapIndexXml(siteUrl)

  c.header('Content-Type', 'application/xml; charset=utf-8')
  c.header('Cache-Control', 'public, max-age=3600')

  return c.text(xml)
}

// Re-export for use in cron job
export { regenerateSitemap } from './sitemap.service'
