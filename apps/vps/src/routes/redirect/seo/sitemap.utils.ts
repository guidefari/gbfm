// Pure functions for sitemap XML generation (no database dependencies)

export interface SitemapEntry {
  slug: string
  updatedAt: Date
}

export interface ProfileEntry {
  username: string | null
  updatedAt: Date
}

export interface PostEntry {
  slug: string
  updatedAt: Date
  type: 'post' | 'micro' | null
}

export interface SitemapData {
  mixes: SitemapEntry[]
  shows: SitemapEntry[]
  releases: SitemapEntry[]
  labels: SitemapEntry[]
  profiles: ProfileEntry[]
  posts: PostEntry[]
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

export const buildSitemapXml = (data: SitemapData, siteUrl: string, vpsUrl?: string): string => {
  const now = new Date()
  const urls: string[] = []
  const dynamicBase = vpsUrl ? `${vpsUrl}/s` : null

  // Homepage
  urls.push(buildUrlEntry(siteUrl, now, 'daily', '1.0'))

  // Static pages
  urls.push(buildUrlEntry(`${siteUrl}/mixes`, now, 'daily', '0.9'))
  urls.push(buildUrlEntry(`${siteUrl}/shows`, now, 'daily', '0.9'))
  urls.push(buildUrlEntry(`${siteUrl}/releases`, now, 'weekly', '0.7'))
  urls.push(buildUrlEntry(`${siteUrl}/labels`, now, 'weekly', '0.7'))
  urls.push(buildUrlEntry(`${siteUrl}/editorial`, now, 'daily', '0.8'))
  urls.push(buildUrlEntry(`${siteUrl}/tweet`, now, 'daily', '0.8'))

  // Mixes
  for (const mix of data.mixes) {
    const loc = dynamicBase ? `${dynamicBase}/mix/${mix.slug}` : `${siteUrl}/mixes/${mix.slug}`
    urls.push(buildUrlEntry(loc, mix.updatedAt, 'weekly'))
  }

  // Shows
  for (const show of data.shows) {
    const loc = dynamicBase ? `${dynamicBase}/show/${show.slug}` : `${siteUrl}/shows/${show.slug}`
    urls.push(buildUrlEntry(loc, show.updatedAt, 'weekly'))
  }

  // Releases
  for (const release of data.releases) {
    const loc = dynamicBase
      ? `${dynamicBase}/release/${release.slug}`
      : `${siteUrl}/releases/${release.slug}`
    urls.push(buildUrlEntry(loc, release.updatedAt, 'monthly', '0.6'))
  }

  // Labels
  for (const label of data.labels) {
    const loc = dynamicBase
      ? `${dynamicBase}/label/${label.slug}`
      : `${siteUrl}/labels/${label.slug}`
    urls.push(buildUrlEntry(loc, label.updatedAt, 'monthly', '0.6'))
  }

  // Profiles (only those with usernames)
  for (const profile of data.profiles) {
    if (profile.username) {
      const loc = dynamicBase
        ? `${dynamicBase}/profile/${profile.username}`
        : `${siteUrl}/${profile.username}`
      urls.push(buildUrlEntry(loc, profile.updatedAt, 'weekly', '0.5'))
    }
  }

  // Posts: 'post' type -> /editorial/:slug, 'micro' type -> /tweet/:slug
  for (const post of data.posts) {
    let loc: string
    if (dynamicBase) {
      loc =
        post.type === 'micro'
          ? `${dynamicBase}/tweet/${post.slug}`
          : `${dynamicBase}/editorial/${post.slug}`
    } else {
      loc =
        post.type === 'micro'
          ? `${siteUrl}/tweet/${post.slug}`
          : `${siteUrl}/editorial/${post.slug}`
    }
    urls.push(buildUrlEntry(loc, post.updatedAt, 'weekly', '0.7'))
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
