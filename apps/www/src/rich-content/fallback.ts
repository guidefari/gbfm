import { inertHtml as h, type Html } from 'foldkit/html'

const inline = (text: string): Array<Html | string> => {
  const parts: Array<Html | string> = []

  const pattern =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?!\/)[^\s)]+)\)|(`[^`]+`)|\*\*([^*]+)\*\*|(https?:\/\/[^\s<>]+)/g

  let cursor = 0

  for (const match of text.matchAll(pattern)) {
    parts.push(text.slice(cursor, match.index))
    const href = match[2] ?? match[5]

    if (href)
      parts.push(
        h.a(
          [
            h.Href(href),
            ...(href.startsWith('http') ? [h.Target('_blank'), h.Rel('noopener noreferrer')] : []),
          ],
          [match[1] ?? href],
        ),
      )
    else if (match[3]) parts.push(h.code([], [match[3].slice(1, -1)]))
    else if (match[4]) parts.push(h.strong([], [match[4]]))
    cursor = match.index + match[0].length
  }

  parts.push(text.slice(cursor))

  return parts
}

/** Render stored writing as inert markup, never evaluating compiled MDX or accepting arbitrary HTML. */
export const richContent = (content: string, className = ''): Html => {
  const output: Array<Html> = []
  let code = false
  let lines: Array<string> = []

  const flush = () => {
    if (lines.length)
      output.push(
        code ? h.pre([], [h.code([], [lines.join('\n')])]) : h.p([], inline(lines.join('\n'))),
      )
    lines = []
  }

  // Legacy exports contain self-closing iframe markup. Only reconstruct the exact trusted SoundCloud player.
  const legacy = /<iframe\b[\s\S]*?(?:\/>|<\/iframe>)\s*(?:<div\b[\s\S]*?<\/div>)?/gi
  let cursor = 0

  const renderText = (text: string) => {
    for (const line of text.split('\n')) {
      if (line.trim().startsWith('```')) {
        flush()
        code = !code
        continue
      }

      if (code) {
        lines.push(line)
        continue
      }

      if (!line.trim()) {
        flush()
        continue
      }

      const heading = /^(#{1,6})\s+(.+)$/.exec(line)

      if (heading?.[2]) {
        flush()
        output.push(h.h2([], inline(heading[2])))
        continue
      }

      if (line.startsWith('> ')) {
        flush()
        output.push(h.blockquote([], inline(line.slice(2))))
        continue
      }

      if (/^[-*+]\s+/.test(line)) {
        flush()
        output.push(h.ul([], [h.li([], inline(line.replace(/^[-*+]\s+/, '')))]))
        continue
      }

      lines.push(line)
    }

    flush()
  }

  for (const match of content.matchAll(legacy)) {
    const src = /\bsrc="([^"]+)"/i.exec(match[0])?.[1]
    let player: URL

    try {
      player = new URL(src ?? '')
    } catch {
      continue
    }

    const track = player.searchParams.get('url')

    if (
      player.origin !== 'https://w.soundcloud.com' ||
      player.pathname !== '/player/' ||
      !track ||
      !/^https:\/\/api\.soundcloud\.com\/tracks\/\d+$/.test(track)
    )
      continue
    renderText(content.slice(cursor, match.index))
    const embed = new URL('https://w.soundcloud.com/player/')
    embed.searchParams.set('url', track)
    output.push(
      h.iframe(
        [
          h.Title('SoundCloud audio player'),
          h.Src(embed.href),
          h.Width('100%'),
          h.Height('166'),
          h.Loading('lazy'),
          h.Allow('autoplay'),
        ],
        [],
      ),
    )
    cursor = match.index + match[0].length
  }

  renderText(content.slice(cursor))

  return h.div([h.Class(`rich-content ${className}`.trim())], output)
}
