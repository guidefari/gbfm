import { Option, Schema } from 'effect'

const ComposerDraftSchema = Schema.Struct({
  type: Schema.Literals(['micro', 'post']),
  title: Schema.String,
  slug: Schema.String,
  content: Schema.String,
  description: Schema.String,
  tags: Schema.String,
  thumbnailUrl: Schema.String,
  creatorIds: Schema.String,
  musicUrl: Schema.String,
  musicEntityType: Schema.Literals(['', 'album', 'track', 'playlist']),
  musicEntityId: Schema.String,
  quotedPostId: Schema.String,
  externalMediaUrl: Schema.String
})

const MixDraftSchema = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  description: Schema.String,
  content: Schema.String,
  tags: Schema.String,
  thumbnailUrl: Schema.String,
  audioUrl: Schema.String,
  creatorId: Schema.String,
  showId: Schema.String,
  episodeNumber: Schema.String,
  draft: Schema.Boolean
})

export type ComposerDraft = {
  type: 'micro' | 'post'
  title: string
  slug: string
  content: string
  description: string
  tags: string
  thumbnailUrl: string
  creatorIds: string
  musicUrl: string
  musicEntityType: '' | 'album' | 'track' | 'playlist'
  musicEntityId: string
  quotedPostId: string
  externalMediaUrl: string
}

export type MixDraft = {
  title: string
  slug: string
  description: string
  content: string
  tags: string
  thumbnailUrl: string
  audioUrl: string
  creatorId: string
  showId: string
  episodeNumber: string
  draft: boolean
}

export const readComposerDraft = (key: string): ComposerDraft | null => {
  try {
    const decoded = Option.getOrNull(
      Schema.decodeUnknownOption(ComposerDraftSchema)(
        JSON.parse(localStorage.getItem(key) ?? 'null')
      )
    )
    return decoded ? { ...decoded } : null
  } catch {
    return null
  }
}

export const readMixDraft = (key: string): MixDraft | null => {
  try {
    const decoded = Option.getOrNull(
      Schema.decodeUnknownOption(MixDraftSchema)(JSON.parse(localStorage.getItem(key) ?? 'null'))
    )
    return decoded ? { ...decoded } : null
  } catch {
    return null
  }
}

export const writeLocalDraft = (key: string, value: ComposerDraft | MixDraft): void => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const clearLocalDraft = (key: string): void => localStorage.removeItem(key)

export const splitCommaList = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
