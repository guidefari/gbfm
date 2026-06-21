import { Schema } from 'effect'

export const DraftTrackEntrySchema = Schema.Struct({
  id: Schema.Number,
  time: Schema.Number,
  title: Schema.String
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
  updatedAt: Schema.Number
})

export type MixUploadDraft = {
  readonly title: string
  readonly description: string
  readonly slug: string
  readonly content: string
  readonly thumbnailUrl: string
  readonly tags: string[]
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

export const emptyMixUploadDraft = (): MixUploadDraft => ({
  title: '',
  description: '',
  slug: '',
  content: '',
  thumbnailUrl: '',
  tags: [],
  tracklist: [],
  audioFingerprint: undefined,
  audioFileName: undefined,
  artworkFingerprint: undefined,
  artworkFileName: undefined,
  showId: undefined,
  episodeNumber: undefined,
  creatorId: undefined,
  url: undefined,
  updatedAt: Date.now()
})

export const parseMixUploadDraft = (raw: unknown): MixUploadDraft | null => {
  try {
    const decoded = Schema.decodeUnknownSync(MixUploadDraftSchema)(raw)
    return {
      title: decoded.title,
      description: decoded.description,
      slug: decoded.slug,
      content: decoded.content,
      thumbnailUrl: decoded.thumbnailUrl,
      tags: [...decoded.tags],
      tracklist: decoded.tracklist.map((t) => ({ id: t.id, time: t.time, title: t.title })),
      audioFingerprint: decoded.audioFingerprint,
      audioFileName: decoded.audioFileName,
      artworkFingerprint: decoded.artworkFingerprint,
      artworkFileName: decoded.artworkFileName,
      showId: decoded.showId,
      episodeNumber: decoded.episodeNumber,
      creatorId: decoded.creatorId,
      url: decoded.url,
      updatedAt: decoded.updatedAt
    }
  } catch {
    return null
  }
}

export type ParsedMixUploadDraft = ReturnType<
  typeof Schema.decodeUnknownSync<typeof MixUploadDraftSchema>
>
