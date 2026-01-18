import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { Context } from 'hono'
import { db } from '@/db'
import { audioCreators, audioTable } from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
import { DatabaseError } from '@/errors'
import { runApp } from '@/runtime'

const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (char) => map[char] || char)
}

const fetchMixBySlug = (slug: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(audioTable)
        .where(and(eq(audioTable.type, 'mix'), eq(audioTable.slug, slug)))
        .limit(1),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'audio'
      })
  })

const fetchCreators = (audioId: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select({
          id: usersTable.id,
          name: usersTable.name
        })
        .from(audioCreators)
        .innerJoin(usersTable, eq(audioCreators.creatorId, usersTable.id))
        .where(eq(audioCreators.audioId, audioId)),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'audio_creators'
      })
  })

export const shareMix = async (c: Context) => {
  const { slug } = c.req.param()

  if (!slug) {
    return c.html(
      `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invalid URL | goosebumps.fm</title>
</head>
<body>
  <h1>Invalid URL</h1>
  <p>The URL is missing a mix slug.</p>
  <a href="https://goosebumps.fm">Go to goosebumps.fm</a>
</body>
</html>
      `,
      400
    )
  }

  const program = Effect.gen(function* () {
    const [audio] = yield* fetchMixBySlug(slug)
    if (!audio) {
      return { found: false } as const
    }

    const creators = yield* fetchCreators(audio.id)
    return { found: true, audio, creators } as const
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    Effect.logError('[Share] Error fetching mix for share', {
      slug,
      error:
        result.left instanceof Error ? result.left.message : String(result.left)
    }).pipe(Effect.runPromise)
    return c.html(
      `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error | goosebumps.fm</title>
</head>
<body>
  <h1>Error</h1>
  <p>Something went wrong while loading this mix.</p>
  <a href="https://goosebumps.fm">Go to goosebumps.fm</a>
</body>
</html>
      `,
      500
    )
  }

  const data = result.right
  if (!data.found) {
    return c.html(
      `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mix not found | goosebumps.fm</title>
</head>
<body>
  <h1>Mix not found</h1>
  <p>The mix you're looking for doesn't exist.</p>
  <a href="https://goosebumps.fm">Go to goosebumps.fm</a>
</body>
</html>
      `,
      404
    )
  }

  const { audio, creators } = data

  const siteUrl = 'https://goosebumps.fm'
  const mixUrl = `${siteUrl}/mixes/${slug}`
  const shareUrl = `${siteUrl}/share/mix/${slug}`

  const title = escapeHtml(audio.title || slug)
  const description = escapeHtml(
    audio.description || `Listen to ${audio.title || slug} on goosebumps.fm`
  )
  const image =
    audio.thumbnailUrl || 'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'
  const creatorNames = escapeHtml(creators.map((c) => c.name).join(', '))

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary Meta Tags -->
  <title>${title} | goosebumps.fm</title>
  <meta name="title" content="${title} | goosebumps.fm">
  <meta name="description" content="${description}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="music.song">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:title" content="${title} | goosebumps.fm">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${title} cover art">
  <meta property="og:site_name" content="goosebumps.fm">
  <meta property="og:locale" content="en_US">
  ${audio.url ? `<meta property="og:audio" content="${audio.url}">` : ''}
  ${audio.url ? `<meta property="og:audio:type" content="audio/mpeg">` : ''}
  ${creatorNames ? `<meta property="music:musician" content="${creatorNames}">` : ''}

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${shareUrl}">
  <meta name="twitter:title" content="${title} | goosebumps.fm">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${title} cover art">

  <!-- Redirect to the actual page after 0 seconds -->
  <meta http-equiv="refresh" content="0;url=${mixUrl}">

  <!-- Canonical URL -->
  <link rel="canonical" href="${mixUrl}">

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
  <img src="${image}" alt="${title} cover art" width="400" height="400">
  <h1>${title}</h1>
  ${creatorNames ? `<p>by ${creatorNames}</p>` : ''}
  <p>Redirecting to goosebumps.fm...</p>
  <a href="${mixUrl}">Click here if you're not redirected automatically</a>

  <script>
    // Fallback JavaScript redirect
    setTimeout(() => {
      window.location.href = '${mixUrl}';
    }, 100);
  </script>
</body>
</html>
  `

  return c.html(html)
}
