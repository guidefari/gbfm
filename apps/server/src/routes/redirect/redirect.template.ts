const DEFAULT_IMAGE = 'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'

export const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (char) => map[char] || char)
}

export type OGType = 'music.song' | 'music.album' | 'profile' | 'article' | 'website'

export interface OGData {
  type: OGType
  title: string
  description: string
  image: string | null
  /** The canonical URL on the SPA (where to redirect) */
  canonicalPath: string
  /** Optional audio URL for music content */
  audio?: string | null
  /** Optional creator names */
  creators?: string[]
  /** Optional alt text for the image */
  imageAlt?: string
  /** Optional published/updated date for articles */
  updatedAt?: Date | null
}

export interface ErrorPageData {
  title: string
  message: string
  statusCode: 400 | 404 | 500
}

const getSiteUrl = (frontendUrl = 'https://goosebumps.fm'): string => {
  // Ensure no trailing slash
  return frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl
}

export const buildOGHtml = (data: OGData, frontendUrl?: string): string => {
  const siteUrl = getSiteUrl(frontendUrl)
  const canonicalUrl = `${siteUrl}${data.canonicalPath}`
  const image = data.image || DEFAULT_IMAGE
  const imageAlt = data.imageAlt || `${data.title} cover art`

  const title = escapeHtml(data.title)
  const description = escapeHtml(data.description)
  const creatorNames = data.creators?.length ? escapeHtml(data.creators.join(', ')) : null

  // Type-specific OG tags
  const typeSpecificTags = buildTypeSpecificTags(data, creatorNames)

  // JSON-LD structured data
  const jsonLd = buildJsonLd(data, canonicalUrl, image, siteUrl)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary Meta Tags -->
  <title>${title} | goosebumps.fm</title>
  <meta name="title" content="${title} | goosebumps.fm">
  <meta name="description" content="${description}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${data.type}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${title} | goosebumps.fm">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
  <meta property="og:site_name" content="goosebumps.fm">
  <meta property="og:locale" content="en_US">
${typeSpecificTags}

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@goosebumpsfm">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${title} | goosebumps.fm">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">${jsonLd}</script>

  <!-- Redirect to the actual page -->
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}">

  <!-- Canonical URL -->
  <link rel="canonical" href="${canonicalUrl}">

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 600px;
      margin: 80px auto;
      padding: 20px;
      text-align: center;
      background: #000;
      color: #fff;
    }

    @media (prefers-color-scheme: light) {
      body {
        background: #fff;
        color: #000;
      }
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 10px;
    }

    p {
      font-size: 1.1rem;
      margin-bottom: 30px;
      opacity: 0.8;
    }

    a {
      color: #3b82f6;
      text-decoration: none;
      font-size: 1.1rem;
    }

    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <img src="${image}" alt="${escapeHtml(imageAlt)}" width="400" height="400">
  <h1>${title}</h1>
  ${creatorNames ? `<p>by ${creatorNames}</p>` : ''}
  <p>Redirecting to goosebumps.fm...</p>
  <a href="${canonicalUrl}">Click here if you're not redirected automatically</a>

  <script>
    setTimeout(() => {
      window.location.href = '${canonicalUrl}';
    }, 100);
  </script>
</body>
</html>`
}

const buildJsonLd = (
  data: OGData,
  canonicalUrl: string,
  image: string,
  siteUrl: string
): string => {
  const base = {
    '@context': 'https://schema.org',
    name: data.title,
    description: data.description,
    image,
    url: canonicalUrl
  }

  if (data.type === 'music.song' || data.type === 'music.album') {
    const schema: Record<string, unknown> = {
      ...base,
      '@type': data.type === 'music.album' ? 'MusicAlbum' : 'MusicRecording'
    }
    if (data.creators?.length) {
      schema.byArtist = data.creators.map((name) => ({
        '@type': 'MusicGroup',
        name
      }))
    }
    if (data.audio) {
      schema.audio = { '@type': 'AudioObject', contentUrl: data.audio }
    }
    return JSON.stringify(schema)
  }

  if (data.type === 'article') {
    const schema: Record<string, unknown> = {
      ...base,
      '@type': 'Article',
      publisher: {
        '@type': 'Organization',
        name: 'goosebumps.fm',
        url: siteUrl
      }
    }
    if (data.creators?.length) {
      schema.author = data.creators.map((name) => ({
        '@type': 'Person',
        name
      }))
    }
    if (data.updatedAt) {
      schema.dateModified = data.updatedAt.toISOString()
    }
    return JSON.stringify(schema)
  }

  if (data.type === 'profile') {
    return JSON.stringify({
      ...base,
      '@type': 'Person'
    })
  }

  return JSON.stringify({
    ...base,
    '@type': 'WebPage',
    isPartOf: { '@type': 'WebSite', name: 'goosebumps.fm', url: siteUrl }
  })
}

const buildTypeSpecificTags = (data: OGData, creatorNames: string | null): string => {
  const tags: string[] = []

  if (data.type === 'music.song' || data.type === 'music.album') {
    if (data.audio) {
      tags.push(`  <meta property="og:audio" content="${data.audio}">`)
      tags.push(`  <meta property="og:audio:type" content="audio/mpeg">`)
    }
    if (creatorNames) {
      tags.push(`  <meta property="music:musician" content="${creatorNames}">`)
    }
  }

  return tags.length ? tags.join('\n') : ''
}

export const buildErrorHtml = (data: ErrorPageData, frontendUrl?: string): string => {
  const siteUrl = getSiteUrl(frontendUrl)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.title)} | goosebumps.fm</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 80px auto; padding: 20px; text-align: center;">
  <h1>${escapeHtml(data.title)}</h1>
  <p>${escapeHtml(data.message)}</p>
  <a href="${siteUrl}">Go to goosebumps.fm</a>
</body>
</html>`
}
