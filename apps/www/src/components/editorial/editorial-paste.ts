import { Effect, Option } from 'effect'
import {
  externalMediaProviders,
  parseExternalMediaUrlEffect,
  type ExternalMediaParseError,
  type ExternalMediaReference
} from './external-media'

export type PastedEditorialContent = {
  readonly content: string
  readonly spotifyUrls: ReadonlyArray<string>
}

export type PendingMusicEntity = ExternalMediaReference & {
  readonly fallback: 'restore-url' | 'remove'
}

const pendingMusicEntityPattern =
  /^<MusicEntityPending url="(https:\/\/open\.spotify\.com\/[^"\s]+)"(?: fallback="(remove)")? \/>$/
const fencedCodePattern = /^\s*(?:`{3,}|~{3,})/
const markdownLinkPattern = /\]\(([^)\s]+)(?:\s+[^)]*)?\)/g

export const transformPastedEditorialContentEffect = (
  content: string
): Effect.Effect<PastedEditorialContent, ExternalMediaParseError> =>
  Effect.gen(function* () {
    const transformed: string[] = []
    const spotifyUrls = new Set<string>()
    const paragraphSpotifyUrls = new Set<string>()
    let insideFencedCode = false

    const appendParagraphEntities = (trailingBlank: boolean) => {
      if (paragraphSpotifyUrls.size === 0) return

      transformed.push('')
      const urls = Array.from(paragraphSpotifyUrls)
      for (const [index, url] of urls.entries()) {
        transformed.push(serializePendingMusicEntity(url, 'remove'))
        if (index < urls.length - 1 || trailingBlank) transformed.push('')
      }
      paragraphSpotifyUrls.clear()
    }

    for (const line of content.split('\n')) {
      if (line.trim() === '') {
        if (paragraphSpotifyUrls.size > 0) appendParagraphEntities(true)
        else transformed.push(line)
        continue
      }

      if (fencedCodePattern.test(line)) {
        insideFencedCode = !insideFencedCode
        transformed.push(line)
        continue
      }

      if (insideFencedCode || line.startsWith('    ') || line.startsWith('\t')) {
        transformed.push(line)
        continue
      }

      const parsed = yield* Effect.option(parseExternalMediaUrlEffect(line.trim()))
      if (Option.isSome(parsed) && parsed.value.provider === externalMediaProviders.spotify) {
        spotifyUrls.add(parsed.value.url)
        transformed.push(serializePendingMusicEntity(parsed.value.url))
        continue
      }

      for (const match of line.matchAll(markdownLinkPattern)) {
        const destination = match[1]
        if (destination === undefined) continue

        const linkedMedia = yield* Effect.option(parseExternalMediaUrlEffect(destination))
        if (
          Option.isSome(linkedMedia) &&
          linkedMedia.value.provider === externalMediaProviders.spotify
        ) {
          spotifyUrls.add(linkedMedia.value.url)
          paragraphSpotifyUrls.add(linkedMedia.value.url)
        }
      }

      transformed.push(line)
    }

    appendParagraphEntities(false)

    return {
      content: transformed.join('\n'),
      spotifyUrls: Array.from(spotifyUrls)
    }
  })

export const parsePendingMusicEntityEffect = (
  markdown: string
): Effect.Effect<PendingMusicEntity, ExternalMediaParseError> =>
  Effect.gen(function* () {
    const match = pendingMusicEntityPattern.exec(markdown.trim())
    const url = match?.[1]
    if (url === undefined) return yield* Effect.fail(invalidEmbed())

    const media = yield* parseExternalMediaUrlEffect(url)
    if (media.provider !== externalMediaProviders.spotify) {
      return yield* Effect.fail(invalidEmbed())
    }

    return {
      ...media,
      fallback: match?.[2] === 'remove' ? 'remove' : 'restore-url'
    }
  })

export function serializePendingMusicEntity(
  url: string,
  fallback: PendingMusicEntity['fallback'] = 'restore-url'
): string {
  const fallbackAttribute = fallback === 'remove' ? ' fallback="remove"' : ''
  return `<MusicEntityPending url="${url}"${fallbackAttribute} />`
}

function invalidEmbed(): ExternalMediaParseError {
  return {
    _tag: 'ExternalMediaParseError',
    message: 'This pending music entity embed is invalid.'
  }
}
