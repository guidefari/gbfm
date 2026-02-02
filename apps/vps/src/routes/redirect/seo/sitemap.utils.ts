// Pure functions for sitemap XML generation (no database dependencies)

export interface SitemapEntry {
  slug: string
  updatedAt: Date
}

export interface ProfileEntry {
  username: string | null
  updatedAt: Date
}

export interface SitemapData {
  mixes: SitemapEntry[]
  shows: SitemapEntry[]
  releases: SitemapEntry[]
  labels: SitemapEntry[]
  profiles: ProfileEntry[]
}

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0] ?? ''
}

export const buildUrlEntry = (
  loc: string,
  lastmod: Date,
  changefreq: string = 'weekly',
  priority: string = '0.8'
): string => {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${formatDate(lastmod)}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

export const buildSitemapXml = (data: SitemapData, siteUrl: string): string => {
  const now = new Date()
  const urls: string[] = []

  // Homepage
  urls.push(buildUrlEntry(siteUrl, now, 'daily', '1.0'))

  // Static pages
  urls.push(buildUrlEntry(`${siteUrl}/mixes`, now, 'daily', '0.9'))
  urls.push(buildUrlEntry(`${siteUrl}/shows`, now, 'daily', '0.9'))
  urls.push(buildUrlEntry(`${siteUrl}/releases`, now, 'weekly', '0.7'))
  urls.push(buildUrlEntry(`${siteUrl}/labels`, now, 'weekly', '0.7'))

  // Mixes
  for (const mix of data.mixes) {
    urls.push(
      buildUrlEntry(`${siteUrl}/mixes/${mix.slug}`, mix.updatedAt, 'weekly')
    )
  }

  // Shows
  for (const show of data.shows) {
    urls.push(
      buildUrlEntry(`${siteUrl}/shows/${show.slug}`, show.updatedAt, 'weekly')
    )
  }

  // Releases
  for (const release of data.releases) {
    urls.push(
      buildUrlEntry(
        `${siteUrl}/releases/${release.slug}`,
        release.updatedAt,
        'monthly',
        '0.6'
      )
    )
  }

  // Labels
  for (const label of data.labels) {
    urls.push(
      buildUrlEntry(
        `${siteUrl}/labels/${label.slug}`,
        label.updatedAt,
        'monthly',
        '0.6'
      )
    )
  }

  // Profiles (only those with usernames)
  for (const profile of data.profiles) {
    if (profile.username) {
      urls.push(
        buildUrlEntry(
          `${siteUrl}/${profile.username}`,
          profile.updatedAt,
          'weekly',
          '0.5'
        )
      )
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`
}

export const buildSitemapIndexXml = (siteUrl: string): string => {
  const now = formatDate(new Date())

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`
}
