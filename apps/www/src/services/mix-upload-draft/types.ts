import { Schema } from 'effect'

export const DraftTrackEntrySchema = Schema.Struct({
  id: Schema.Number,
  time: Schema.Number,
  title: Schema.String,
})

export const MixUploadDraftSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  slug: Schema.String,
  content: Schema.String,
  thumbnailUrl: Schema.String,
  tags: Schema.Array(Schema.String),
  tracklist: Schema.Array(DraftTrackEntrySchema),
  audioFingerprint: Schema.optional(Schema.String),
  audioFileName: Schema.optional(Schema.String),
  artworkFingerprint: Schema.optional(Schema.String),
  artworkFileName: Schema.optional(Schema.String),
  showId: Schema.optional(Schema.String),
  episodeNumber: Schema.optional(Schema.String),
  creatorId: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
  updatedAt: Schema.Number,
})

type StoredDraftInput =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<StoredDraftInput>
  | { readonly [key: string]: StoredDraftInput }

export type MixUploadDraft = {
  readonly title: string
  readonly description: string
  readonly slug: string
  readonly content: string
  readonly thumbnailUrl: string
  readonly tags: Array<string>
  readonly tracklist: Array<{ readonly id: number; readonly time: number; readonly title: string }>
  readonly audioFingerprint?: string
  readonly audioFileName?: string
  readonly artworkFingerprint?: string
  readonly artworkFileName?: string
  readonly showId?: string
  readonly episodeNumber?: string
  readonly creatorId?: string
  readonly url?: string
  readonly updatedAt: number
}

type MutableMixUploadDraft = { -readonly [Key in keyof MixUploadDraft]: MixUploadDraft[Key] }

export const emptyMixUploadDraft = (): MixUploadDraft => ({
  title: '',
  description: '',
  slug: '',
  content: '',
  thumbnailUrl: '',
  tags: [],
  tracklist: [],
  updatedAt: Date.now(),
})

export const parseMixUploadDraft = (raw: StoredDraftInput): MixUploadDraft | null => {
  try {
    const decoded = Schema.decodeUnknownSync(MixUploadDraftSchema)(raw)

    const draft: MutableMixUploadDraft = {
      title: decoded.title,
      description: decoded.description,
      slug: decoded.slug,
      content: decoded.content,
      thumbnailUrl: decoded.thumbnailUrl,
      tags: [...decoded.tags],
      tracklist: decoded.tracklist.map((t) => ({ id: t.id, time: t.time, title: t.title })),
      updatedAt: decoded.updatedAt,
    }

    if (decoded.audioFingerprint !== undefined) draft.audioFingerprint = decoded.audioFingerprint

    if (decoded.audioFileName !== undefined) draft.audioFileName = decoded.audioFileName

    if (decoded.artworkFingerprint !== undefined)
      draft.artworkFingerprint = decoded.artworkFingerprint

    if (decoded.artworkFileName !== undefined) draft.artworkFileName = decoded.artworkFileName

    if (decoded.showId !== undefined) draft.showId = decoded.showId

    if (decoded.episodeNumber !== undefined) draft.episodeNumber = decoded.episodeNumber

    if (decoded.creatorId !== undefined) draft.creatorId = decoded.creatorId

    if (decoded.url !== undefined) draft.url = decoded.url

    return draft
  } catch {
    return null
  }
}

export type ParsedMixUploadDraft = ReturnType<
  typeof Schema.decodeUnknownSync<typeof MixUploadDraftSchema>
>
