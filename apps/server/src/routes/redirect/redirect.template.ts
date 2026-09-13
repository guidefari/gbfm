import { renderMetadataHtml, type SiteMetadata } from '@gbfm/site-metadata'

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ??
      character
  )

const getSiteUrl = (frontendUrl = 'https://goosebumps.fm') => frontendUrl.replace(/\/$/, '')

/** Renders the legacy share document from the same model and tags as canonical pages. */
export const buildShareHtml = (metadata: SiteMetadata): string => {
  const creators = metadata.creators.length > 0 ? escapeHtml(metadata.creators.join(', ')) : null
  const canonicalUrl = escapeHtml(metadata.canonicalUrl)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${renderMetadataHtml(metadata)}
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 80px auto; padding: 20px; text-align: center; background: #000; color: #fff; }
    img { max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 20px; }
    p { opacity: 0.8; }
    a { color: #3b82f6; }
    @media (prefers-color-scheme: light) { body { background: #fff; color: #000; } }
  </style>
</head>
<body>
  <img src="${escapeHtml(metadata.image.url)}" alt="${escapeHtml(metadata.image.alt)}" width="400" height="400">
  <h1>${escapeHtml(metadata.title)}</h1>
  ${creators ? `<p>by ${creators}</p>` : ''}
  <p>Redirecting to goosebumps.fm...</p>
  <a href="${canonicalUrl}">Click here if you're not redirected automatically</a>
  <script>setTimeout(() => { window.location.href = ${JSON.stringify(metadata.canonicalUrl).replace(/</g, String.raw`\u003c`)} }, 100)</script>
</body>
</html>`
}

export interface ErrorPageData {
  readonly title: string
  readonly message: string
  readonly statusCode: 400 | 404 | 500
}

export const buildErrorHtml = (data: ErrorPageData, frontendUrl?: string): string => {
  const siteUrl = getSiteUrl(frontendUrl)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(data.title)} | goosebumps.fm</title>
</head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 80px auto; padding: 20px; text-align: center;">
  <h1>${escapeHtml(data.title)}</h1>
  <p>${escapeHtml(data.message)}</p>
  <a href="${escapeHtml(siteUrl)}">Go to goosebumps.fm</a>
</body>
</html>`
}
