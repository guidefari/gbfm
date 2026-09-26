import { externalMediaEmbed, parseExternalMediaUrl } from '@/components/editorial/external-media'

type ContentPart =
  | { readonly type: 'text'; readonly content: string }
  | {
      readonly type: 'embed'
      readonly src: string
      readonly title: string
      readonly height: number
      readonly href: string
    }

const embedPattern = /<iframe\b[\s\S]*?\/>\s*<div\b[\s\S]*?<\/div>/gi

export const splitLegacySoundCloud = (content: string): ReadonlyArray<ContentPart> => {
  const parts: Array<ContentPart> = []
  let cursor = 0

  for (const match of content.matchAll(embedPattern)) {
    const markup = match[0]
    const source = /\bsrc="([^"]+)"/i.exec(markup)?.[1]

    if (!source) continue

    let player: URL

    try {
      player = new URL(source)
    } catch {
      continue
    }

    if (
      player.protocol !== 'https:' ||
      player.hostname !== 'w.soundcloud.com' ||
      player.pathname !== '/player/'
    )
      continue

    const trackSource = player.searchParams.get('url')

    if (!trackSource || !/^https:\/\/api\.soundcloud\.com\/tracks\/\d+$/.test(trackSource)) continue

    const links = [...markup.matchAll(/\bhref="(https:\/\/[^"]+)"/gi)]

    const media = links
      .map((link) => parseExternalMediaUrl(link[1] ?? ''))
      .find((parsed) => parsed.ok && parsed.media.provider === 'soundcloud')

    if (!media?.ok) continue
    const embed = externalMediaEmbed(media.media)

    if (!embed) continue

    if (match.index > cursor)
      parts.push({ type: 'text', content: content.slice(cursor, match.index) })
    parts.push({
      type: 'embed',
      src: embed.src,
      title: embed.title,
      height: embed.height,
      href: media.media.url,
    })
    cursor = match.index + markup.length
  }

  if (cursor < content.length) parts.push({ type: 'text', content: content.slice(cursor) })

  return parts
}
