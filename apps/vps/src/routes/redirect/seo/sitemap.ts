import { Effect } from 'effect'
import type { Context } from 'hono'
import { runApp } from '@/runtime'
import { config } from '@/services/config.service'
import { buildSitemapIndexXml, getCachedSitemap } from './sitemap.service'

const EMPTY_SITEMAP =
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'

export const sitemapXml = async (c: Context) => {
  const program = getCachedSitemap.pipe(
    Effect.map((data) => ({ data, status: 200 as const })),
    Effect.catch((error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[Sitemap] Error getting sitemap', {
          error: error instanceof Error ? error.message : String(error)
        })
        return { error: EMPTY_SITEMAP, status: 500 as const }
      })
    )
  )

  const result = await runApp(program)

  c.header('Content-Type', 'application/xml; charset=utf-8')

  if ('error' in result) {
    return c.text(result.error, result.status)
  }

  const { xml, generatedAt } = result.data

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
