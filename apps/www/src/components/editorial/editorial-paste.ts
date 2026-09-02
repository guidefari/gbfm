import { Effect, Option } from 'effect'
import {
  externalMediaMarkdown,
  externalMediaProviders,
  parseExternalMediaUrlEffect,
  type ExternalMediaParseError,
  type ExternalMediaReference
} from './external-media'

const spotifyEmbedPattern =
  /^<ExternalMedia provider="spotify" url="(https:\/\/open\.spotify\.com\/[^"\s]+)" \/>$/
const fencedCodePattern = /^\s*(?:`{3,}|~{3,})/

export const transformPastedEditorialContentEffect = (
  content: string
): Effect.Effect<string, ExternalMediaParseError> =>
  Effect.gen(function* () {
    const transformed: string[] = []
    let insideFencedCode = false

    for (const line of content.split('\n')) {
      if (fencedCodePattern.test(line)) {
        insideFencedCode = !insideFencedCode
        transformed.push(line)
        continue
      }

      if (insideFencedCode || line.startsWith('    ') || line.startsWith('\t')) {
        transformed.push(line)
        continue
      }

      const trimmed = line.trim()
      const parsed = yield* Effect.option(parseExternalMediaUrlEffect(trimmed))
      if (Option.isSome(parsed) && parsed.value.provider === externalMediaProviders.spotify) {
        transformed.push(externalMediaMarkdown(parsed.value))
        continue
      }

      transformed.push(line)
    }

    return transformed.join('\n')
  })

export const parseSpotifyEmbedMarkdownEffect = (
  markdown: string
): Effect.Effect<ExternalMediaReference, ExternalMediaParseError> =>
  Effect.gen(function* () {
    const match = spotifyEmbedPattern.exec(markdown.trim())
    const url = match?.[1]
    if (url === undefined) return yield* Effect.fail(invalidEmbed())

    const media = yield* parseExternalMediaUrlEffect(url)
    if (media.provider !== externalMediaProviders.spotify) {
      return yield* Effect.fail(invalidEmbed())
    }

    return media
  })

function invalidEmbed(): ExternalMediaParseError {
  return {
    _tag: 'ExternalMediaParseError',
    message: 'This Spotify embed is invalid.'
  }
}
