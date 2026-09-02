import { Effect, Schema } from 'effect'

export type MusicEntityType = 'album' | 'track' | 'playlist'

export type MusicEntityReference = {
  readonly type: MusicEntityType
  readonly id: string
}

export const musicEntityTypes: ReadonlyArray<MusicEntityType> = ['album', 'track', 'playlist']

export type MusicEntityParseError = {
  readonly _tag: 'MusicEntityParseError'
  readonly message: string
}

const MusicEntityReferenceSchema = Schema.Struct({
  type: Schema.Literals(['album', 'track', 'playlist']),
  id: Schema.NonEmptyString
})

const musicEntityPattern = /^<MusicEntity type="([^"]+)" id="([^"]+)" \/>$/

export function serializeMusicEntity({ type, id }: MusicEntityReference): string {
  const escapedId = id.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  return `<MusicEntity type="${type}" id="${escapedId}" />`
}

export const parseMusicEntityMarkdownEffect = (
  markdown: string
): Effect.Effect<MusicEntityReference, MusicEntityParseError> => {
  const match = musicEntityPattern.exec(markdown.trim())

  return Schema.decodeUnknownEffect(MusicEntityReferenceSchema)({
    type: match?.[1],
    id: match?.[2]
  }).pipe(
    Effect.mapError(() => ({
      _tag: 'MusicEntityParseError' as const,
      message: 'This music entity embed is invalid.'
    }))
  )
}
