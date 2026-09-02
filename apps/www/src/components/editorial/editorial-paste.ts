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

const pendingMusicEntityPattern =
  /^<MusicEntityPending url="(https:\/\/open\.spotify\.com\/[^"\s]+)" \/>$/
const fencedCodePattern = /^\s*(?:`{3,}|~{3,})/

export const transformPastedEditorialContentEffect = (
  content: string
): Effect.Effect<PastedEditorialContent, ExternalMediaParseError> =>
  Effect.gen(function* () {
    const transformed: string[] = []
    const spotifyUrls = new Set<string>()
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

      const parsed = yield* Effect.option(parseExternalMediaUrlEffect(line.trim()))
      if (Option.isSome(parsed) && parsed.value.provider === externalMediaProviders.spotify) {
        spotifyUrls.add(parsed.value.url)
        transformed.push(serializePendingMusicEntity(parsed.value.url))
        continue
      }

      transformed.push(line)
    }

    return {
      content: transformed.join('\n'),
      spotifyUrls: Array.from(spotifyUrls)
    }
  })

export const parsePendingMusicEntityEffect = (
  markdown: string
): Effect.Effect<ExternalMediaReference, ExternalMediaParseError> =>
  Effect.gen(function* () {
    const match = pendingMusicEntityPattern.exec(markdown.trim())
    const url = match?.[1]
    if (url === undefined) return yield* Effect.fail(invalidEmbed())

    const media = yield* parseExternalMediaUrlEffect(url)
    if (media.provider !== externalMediaProviders.spotify) {
      return yield* Effect.fail(invalidEmbed())
    }

    return media
  })

export function serializePendingMusicEntity(url: string): string {
  return `<MusicEntityPending url="${url}" />`
}

function invalidEmbed(): ExternalMediaParseError {
  return {
    _tag: 'ExternalMediaParseError',
    message: 'This pending music entity embed is invalid.'
  }
}
