import type { Context } from 'hono'
import { config } from '@/services/config.service'

export const robotsTxt = (c: Context) => {
  const siteUrl = config.urls.frontend.replace(/\/$/, '')

  const robots = `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

# Sitemaps
Sitemap: ${siteUrl}/sitemap.xml
`

  c.header('Content-Type', 'text/plain; charset=utf-8')
  c.header('Cache-Control', 'public, max-age=86400') // 24 hours
  return c.text(robots)
}
